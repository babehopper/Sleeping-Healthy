#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "lwip/err.h"
#include "lwip/sys.h"

#include "../../_components/nvs_component.h"
#include "../../_components/time_component.h"

// ── MQTT + DHT22 ──────────────────────────────────────
#include "../../_components/mqtt_component.h"
#include "../../_components/dht_component.h"

// ── Config ────────────────────────────────────────────
// !! CHANGE THESE to your phone hotspot credentials !!
#define ESP_WIFI_SSID      "薄荷马铃薯"
#define ESP_WIFI_PASS      "153512wyh"

// Cloud MQTT broker
#define MQTT_BROKER_URL    "mqtt://112.124.104.229:1883"
#define DEVICE_ID          "ESP-001"

#ifdef CONFIG_WIFI_CHANNEL
#define WIFI_CHANNEL CONFIG_WIFI_CHANNEL
#else
#define WIFI_CHANNEL 6
#endif

#define SHOULD_COLLECT_CSI 1
#define SHOULD_COLLECT_ONLY_LLTF 1
#define SEND_CSI_TO_SERIAL 1
#define SEND_CSI_TO_SD 0

// Enable MQTT output in csi_component.h
#define CONFIG_SEND_CSI_TO_MQTT 1

// ── DHT22 ─────────────────────────────────────────────
#define DHT22_GPIO 4
#define DHT22_INTERVAL_MS 5000

// Minimal outprintf (csi_component.h needs this, normally from sd_component.h)
#include <stdarg.h>
void outprintf(const char *format, ...) {
    va_list args; va_start(args, format); vprintf(format, args); va_end(args);
}

#include "../../_components/csi_component.h"
#include "../../_components/input_component.h"
#include "../../_components/sockets_component.h"

// ── WiFi event group ──────────────────────────────────
static EventGroupHandle_t s_wifi_event_group;
const int WIFI_CONNECTED_BIT = BIT0;
static const char *TAG = "sleep-monitor";

bool is_wifi_connected() {
    return (xEventGroupGetBits(s_wifi_event_group) & WIFI_CONNECTED_BIT);
}

// ── MQTT CSI output (called from csi_component.h / WiFi callback) ─────
// WiFi callback runs at high priority; we must NOT call mqtt_publish directly.
// Use lock-free ring buffer: callback writes, sender task reads.
static char csi_line_buf[3000] = {0};
static volatile bool csi_line_ready = false;

void mqtt_publish_csi_line(const char *line) {
    // Lock-free: worst case we send a partially-overwritten line, harmless
    strncpy(csi_line_buf, line, sizeof(csi_line_buf) - 1);
    csi_line_buf[sizeof(csi_line_buf) - 1] = '\0';
    csi_line_ready = true;
}

// Dedicated task: sends buffered CSI line via MQTT (static buf to avoid stack overflow)
static char csi_send_buf[3000];
static void csi_mqtt_task(void *pvParameters) {
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(500));
        if (!csi_line_ready) continue;
        memcpy(csi_send_buf, (const char*)csi_line_buf, sizeof(csi_send_buf));
        csi_line_ready = false;
        mqtt_publish("csi/raw", csi_send_buf);
    }
}

// ── DHT22 MQTT task ────────────────────────────────────
static void dht_mqtt_task(void *pvParameters) {
    ESP_LOGI(TAG, "DHT22 task started on GPIO %d", DHT22_GPIO);
    dht_init(DHT22_GPIO);
    vTaskDelay(pdMS_TO_TICKS(2000));

    char payload[128];
    int fail_count = 0, ok_count = 0;
    while (1) {
        float t = 0, h = 0;
        if (dht_read(&t, &h)) {
            ok_count++;
            fail_count = 0;
            snprintf(payload, sizeof(payload),
                     "{\"device_id\":\"%s\",\"temperature\":%.1f,\"humidity\":%.1f}",
                     DEVICE_ID, t, h);
            mqtt_publish("csi/environment", payload);
            if (ok_count <= 3 || ok_count % 20 == 0)
                ESP_LOGI(TAG, "ENV %.1f°C %.1f%% (#%d)", t, h, ok_count);
        } else {
            fail_count++;
            ESP_LOGW(TAG, "DHT22 fail #%d", fail_count);
        }
        vTaskDelay(pdMS_TO_TICKS(DHT22_INTERVAL_MS));
    }
}

// ── WiFi event handler ─────────────────────────────────
static void event_handler(void* arg, esp_event_base_t event_base,
                          int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGI(TAG, "WiFi disconnected, retrying...");
        esp_wifi_connect();
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP:" IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

void station_init() {
    s_wifi_event_group = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id, instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                        &event_handler, NULL, &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                                        &event_handler, NULL, &instance_got_ip));

    wifi_config_t wifi_config = {};
    wifi_config.sta.channel = WIFI_CHANNEL;
    strlcpy((char *)wifi_config.sta.ssid, ESP_WIFI_SSID, sizeof(ESP_WIFI_SSID));
    strlcpy((char *)wifi_config.sta.password, ESP_WIFI_PASS, sizeof(ESP_WIFI_PASS));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    esp_wifi_set_ps(WIFI_PS_NONE);

    ESP_LOGI(TAG, "Connecting to SSID:%s", ESP_WIFI_SSID);
}

// ── Config print ───────────────────────────────────────
void config_print() {
    printf("\n\n\n\n\n\n\n\n");
    printf("-----------------------\n");
    printf("Sleep Monitor (STA+MQTT)\n");
    printf("-----------------------\n");
    printf("IDF_VER: %s\n", IDF_VER);
    printf("ESP_WIFI_SSID: %s\n", ESP_WIFI_SSID);
    printf("MQTT_BROKER: %s\n", MQTT_BROKER_URL);
    printf("-----------------------\n");
    printf("\n\n\n\n\n\n\n\n");
}

// ── Socket transmitter (generates WiFi traffic for CSI) ─
esp_err_t esp_wifi_80211_tx(wifi_interface_t ifx, const void *buffer, int len, bool en_sys_seq);
TaskHandle_t xHandle = NULL;

void vTask_socket_transmitter_sta_loop(void *pvParameters) {
    for (;;) {
        socket_transmitter_sta_loop(&is_wifi_connected);
    }
}

// ── Main ───────────────────────────────────────────────
extern "C" void app_main() {
    config_print();
    nvs_init();
    station_init();

    // Wait for WiFi connection
    ESP_LOGI(TAG, "Waiting for WiFi...");
    xEventGroupWaitBits(s_wifi_event_group, WIFI_CONNECTED_BIT, pdFALSE, pdTRUE, portMAX_DELAY);
    ESP_LOGI(TAG, "WiFi connected!");

    // Connect MQTT to cloud
    ESP_LOGI(TAG, "Connecting MQTT to %s...", MQTT_BROKER_URL);
    mqtt_init(MQTT_BROKER_URL);

    // Start CSI collection
    csi_init((char *)"STA");

    // Socket transmitter task (triggers CSI data)
    xTaskCreatePinnedToCore(&vTask_socket_transmitter_sta_loop, "socket_transmitter_sta_loop",
                            10000, (void *)&is_wifi_connected, 5, &xHandle, 1);

    // Start CSI MQTT sender task (low priority, safe context, LARGE stack)
    xTaskCreate(csi_mqtt_task, "csi_mqtt", 8192, NULL, 3, NULL);

    // Start DHT22 task (high priority, core 1 to avoid WiFi interference)
    xTaskCreatePinnedToCore(dht_mqtt_task, "dht_mqtt", 4096, NULL, 10, NULL, 1);

    // Keep main task alive
    while (1) { vTaskDelay(pdMS_TO_TICKS(10000)); }
}
