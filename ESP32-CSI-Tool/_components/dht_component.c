#include "dht_component.h"
#include "driver/gpio.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"
#include <string.h>

static int dht_gpio = 4;

void dht_init(int gpio_pin) {
    dht_gpio = gpio_pin;
    gpio_set_pull_mode(dht_gpio, GPIO_PULLUP_ONLY);
}

static inline int wait_until(int level, int timeout_us) {
    for (int waited = 0; waited < timeout_us; waited++) {
        if (gpio_get_level(dht_gpio) == level) return waited;
        esp_rom_delay_us(1);
    }
    return -1;
}

static inline int wait_while(int level, int timeout_us) {
    for (int waited = 0; waited < timeout_us; waited++) {
        if (gpio_get_level(dht_gpio) != level) return waited;
        esp_rom_delay_us(1);
    }
    return -1;
}

bool dht_read(float *temperature, float *humidity) {
    uint8_t data[5] = {0};

    gpio_set_direction(dht_gpio, GPIO_MODE_OUTPUT);
    gpio_set_level(dht_gpio, 0);
    esp_rom_delay_us(20000);
    gpio_set_level(dht_gpio, 1);
    esp_rom_delay_us(40);
    gpio_set_direction(dht_gpio, GPIO_MODE_INPUT);

    if (wait_until(0, 150) < 0) return false;
    if (wait_until(1, 150) < 0) return false;
    if (wait_until(0, 150) < 0) return false;

    // Read 40 bits — try up to 3 times if interrupted
    for (int attempt = 0; attempt < 3; attempt++) {
        memset(data, 0, 5);
        portDISABLE_INTERRUPTS();
        int bit_ok = 1;
        for (int i = 0; i < 40; i++) {
            if (wait_until(1, 100) < 0) { bit_ok = 0; break; }
            int hi = wait_while(1, 100);
            if (hi < 0) { bit_ok = 0; break; }
            data[i / 8] <<= 1;
            if (hi > 40) data[i / 8] |= 1;
        }
        portENABLE_INTERRUPTS();

        if (bit_ok && data[4] == ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) {
            *humidity    = ((data[0] << 8) | data[1]) / 10.0f;
            *temperature = ((data[2] << 8) | data[3]) / 10.0f;
            return true;
        }
        // Short delay before retry
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    return false;
}
