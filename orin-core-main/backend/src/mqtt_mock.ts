import * as mqtt from 'mqtt';

/**
 * MQTT Bridge Simulator for Philips Hue & Google Nest
 * In Phase 1 MVP, we simulate sending hardware pulses to these topics
 */

// NOTE: You can run a local mosquitto broker or use a free public broker like test.mosquitto.org
const MQTT_BROKER_URL = process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org';
let client: mqtt.MqttClient | null = null;

try {
    client = mqtt.connect(MQTT_BROKER_URL);
    client.on('connect', () => {
        console.log(`[ORIN-IoT] 🔌 MQTT Client connected to Mock broker (${MQTT_BROKER_URL})`);
    });
} catch (error) {
    console.error(`[ORIN-IoT] Failed to connect to MQTT broker: ${error}`);
}

export function adjustRoomEnvironment(guestPubkey: string, preferences: any) {
    console.log(`\n[MQTT Bridge] 📡 Building MQTT Packets for Guest: ${guestPubkey}`);
    
    // In our architecture, the guest's physical location could be "room101"
    const roomId = "room101";

    // 1. Simulate Philips Hue API command
    // Expected hardware topic: orin/hotel/{roomId}/hue/set
    const hueTopic = `orin/hotel/${roomId}/hue/set`;
    const huePayload = JSON.stringify({
        state: "ON",
        color: preferences.light_color || "#FFFFFF",
        brightness: preferences.brightness || 100
    });

    if (client && client.connected) {
        client.publish(hueTopic, huePayload);
        console.log(`[MQTT Publish 💡] Topic: ${hueTopic} | Payload: ${huePayload}`);
    } else {
        console.warn(`[MQTT Publish 💡] Broker offline. Payload: ${huePayload}`);
    }
    
    // 2. Simulate Google Nest API command
    // Expected hardware topic: orin/hotel/{roomId}/nest/set
    const nestTopic = `orin/hotel/${roomId}/nest/set`;
    const nestPayload = JSON.stringify({
        target_temperature_c: preferences.temp || 24,
        mode: "COOL"
    });

    if (client && client.connected) {
        client.publish(nestTopic, nestPayload);
        console.log(`[MQTT Publish 🌡️] Topic: ${nestTopic} | Payload: ${nestPayload}`);
    } else {
        console.warn(`[MQTT Publish 🌡️] Broker offline. Payload: ${nestPayload}`);
    }
    
    console.log(`[IoT Response] ✅ Room physical layer bridging complete.\n`);
}
