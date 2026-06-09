#pragma once
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Connect to MQTT broker. Blocks until connected or max retries reached. */
void mqtt_init(const char *broker_url);

/** Publish a message to a topic (fire-and-forget). */
void mqtt_publish(const char *topic, const char *payload);

/** Check if MQTT is connected. */
bool mqtt_is_connected(void);

#ifdef __cplusplus
}
#endif
