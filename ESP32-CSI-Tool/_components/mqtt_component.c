#include "mqtt_component.h"
#include "mqtt_client.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

static const char *TAG = "MQTT";
static esp_mqtt_client_handle_t client = NULL;
static EventGroupHandle_t mqtt_event_group = NULL;
static const int MQTT_CONNECTED_BIT = BIT0;

static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data) {
    switch (event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "Connected to broker");
        xEventGroupSetBits(mqtt_event_group, MQTT_CONNECTED_BIT);
        break;
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "Disconnected from broker");
        xEventGroupClearBits(mqtt_event_group, MQTT_CONNECTED_BIT);
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT error");
        break;
    default:
        break;
    }
}

void mqtt_init(const char *broker_url) {
    mqtt_event_group = xEventGroupCreate();

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = broker_url,
        .session.keepalive = 30,
    };
    client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(client);

    // Wait up to 15 seconds for connection
    EventBits_t bits = xEventGroupWaitBits(mqtt_event_group, MQTT_CONNECTED_BIT,
                                           pdFALSE, pdTRUE, pdMS_TO_TICKS(15000));
    if (bits & MQTT_CONNECTED_BIT) {
        ESP_LOGI(TAG, "MQTT ready");
    } else {
        ESP_LOGE(TAG, "MQTT connection timeout");
    }
}

void mqtt_publish(const char *topic, const char *payload) {
    if (client && (xEventGroupGetBits(mqtt_event_group) & MQTT_CONNECTED_BIT)) {
        esp_mqtt_client_publish(client, topic, payload, 0, 0, 0);
    }
}

bool mqtt_is_connected(void) {
    return (xEventGroupGetBits(mqtt_event_group) & MQTT_CONNECTED_BIT) != 0;
}
