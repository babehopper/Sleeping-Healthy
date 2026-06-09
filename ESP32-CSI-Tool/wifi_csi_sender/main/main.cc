/* ESP32 WiFi HTTP 发送CSI数据到Flask API

   配置步骤：
   1. 修改 WIFI_SSID 和 WIFI_PASSWORD 为你的WiFi
   2. 修改 API_URL 为电脑的IP地址 (http://192.168.x.x:5000/api/device/ESP-001/csi-data)
   3. 上传程序到ESP32
   4. 打开串口监视器查看输出
*/

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_spi_flash.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_timer.h"

#include "lwip/err.h"
#include "lwip/sys.h"

#include "../../_components/nvs_component.h"
#include "../../_components/csi_component.h"
#include "../../_components/time_component.h"
#include "../../_components/input_component.h"

/* WiFi配置 - 修改为你的WiFi */
#define WIFI_SSID      "你的WiFi名称"
#define WIFI_PASSWORD  "你的WiFi密码"

/* Flask API配置 - 修改为电脑的IP地址 */
#define API_URL        "http://192.168.x.x:5000/api/device/ESP-001/csi-data"

#ifdef CONFIG_WIFI_CHANNEL
#define WIFI_CHANNEL CONFIG_WIFI_CHANNEL
#else
#define WIFI_CHANNEL 6
#endif

#define SHOULD_COLLECT_CSI 1
#define WIFI_CONNECT_TIMEOUT_MS 10000

static EventGroupHandle_t s_wifi_event_group;
const int WIFI_CONNECTED_BIT = BIT0;

static const char *TAG = "WiFi CSI Sender";

esp_err_t _http_event_handle(esp_http_client_event_t *evt) {
    switch(evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            ESP_LOGI(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGI(TAG, "HTTP request finished");
            break;
        default:
            break;
    }
    return ESP_OK;
}

void send_csi_to_api(const char *csi_data) {
    esp_http_client_config_t config = {
        .url = API_URL,
        .event_handler = _http_event_handle,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");

    char post_data[512];
    int64_t timestamp = esp_timer_get_time() / 1000;  // 微秒转毫秒

    // 构造JSON数据 (简化版)
    snprintf(post_data, sizeof(post_data),
        "{\"user_id\":1,\"bpm\":16,\"confidence\":0.85,"
        "\"motion_detected\":false,\"sleep_state\":\"sleeping\","
        "\"timestamp\":\"%lld\",\"csi_sample\":\"%s\"}",
        timestamp, csi_data);

    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP POST Status = %d", status_code);
    } else {
        ESP_LOGE(TAG, "HTTP POST request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
}

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
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

void wifi_init_sta() {
    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_sta_config_t wifi_config = {};
    wifi_config.channel = WIFI_CHANNEL;
    wifi_config.threshold.rmf_cal = 1;
    wifi_config.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.pmf_cfg.capable = true;
    wifi_config.pmf_cfg.required = false;

    wifi_config_t config = {
        .sta = wifi_config,
    };

    strlcpy((char *) config.sta.ssid, WIFI_SSID, sizeof(WIFI_SSID));
    strlcpy((char *) config.sta.password, WIFI_PASSWORD, sizeof(WIFI_PASSWORD));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "wifi_init_sta finished. Connecting to SSID: %s", WIFI_SSID);

    // 等待WiFi连接
    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
                                            WIFI_CONNECTED_BIT,
                                            pdFALSE,
                                            pdFALSE,
                                            pdMS_TO_TICKS(WIFI_CONNECT_TIMEOUT_MS));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "WiFi connected successfully!");
    } else {
        ESP_LOGE(TAG, "WiFi connection timeout!");
    }
}

TaskHandle_t xHandle = NULL;
static bool wifi_connected = false;

void vTask_csi_sender_loop(void *pvParameters) {
    int send_count = 0;
    int64_t last_send_time = 0;

    while (1) {
        if (xEventGroupGetBits(s_wifi_event_group) & WIFI_CONNECTED_BIT) {
            if (!wifi_connected) {
                ESP_LOGI(TAG, "WiFi is connected, starting CSI sender");
                wifi_connected = true;
            }

            // 每30秒发送一次数据
            int64_t now = esp_timer_get_time() / 1000;
            if (now - last_send_time >= 30000) {
                last_send_time = now;
                send_count++;

                char csi_info[128];
                snprintf(csi_info, sizeof(csi_info), "CSI_Sample_%d", send_count);

                ESP_LOGI(TAG, "Sending CSI data #%d to API", send_count);
                send_csi_to_api(csi_info);

                ESP_LOGI(TAG, "Free heap: %lu bytes", esp_get_free_heap_size());
            }
        } else {
            if (wifi_connected) {
                ESP_LOGW(TAG, "WiFi disconnected");
                wifi_connected = false;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void config_print() {
    printf("\n\n");
    printf("====================\n");
    printf("ESP32 WiFi CSI Sender\n");
    printf("====================\n");
    printf("WiFi SSID: %s\n", WIFI_SSID);
    printf("API URL: %s\n", API_URL);
    printf("====================\n\n");
}

extern "C" void app_main() {
    config_print();

    nvs_init();
    wifi_init_sta();
    csi_init((char *) "STA");

#if !(SHOULD_COLLECT_CSI)
    printf("CSI collection disabled\n");
#endif

    xTaskCreatePinnedToCore(&vTask_csi_sender_loop, "csi_sender",
                            4096, NULL, 3, &xHandle, 1);
}
