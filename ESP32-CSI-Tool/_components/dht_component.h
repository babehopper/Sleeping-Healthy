#pragma once
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void dht_init(int gpio_pin);
bool dht_read(float *temperature, float *humidity);

#ifdef __cplusplus
}
#endif
