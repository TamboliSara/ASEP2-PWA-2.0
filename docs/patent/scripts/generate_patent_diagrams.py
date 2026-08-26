import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

output_dir = r"C:\Users\tambo\.gemini\antigravity-ide\brain\b281f29f-3014-4a9f-a6a7-90fa8fba360b"

def generate_fig1_circuit():
    fig, ax = plt.subplots(figsize=(11, 8.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 97, "FIG. 1", fontsize=16, fontweight='bold', ha='center')
    ax.text(50, 94, "HARDWARE CIRCUIT & EMBEDDED ACTUATION SCHEMATIC", fontsize=11, fontstyle='italic', ha='center')

    rect_outer = patches.Rectangle((3, 3), 94, 88, linewidth=1.5, edgecolor='black', facecolor='none', linestyle='--')
    ax.add_patch(rect_outer)
    ax.text(5, 88, "100 (SAFE ENCLOSURE / EMBEDDED NODE)", fontsize=9, fontweight='bold')

    # Power Supply 116
    ax.add_patch(patches.Rectangle((6, 70), 22, 14, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(26, 85, "116", fontsize=9, fontweight='bold')
    ax.text(17, 79, "POWER SUPPLY UNIT", fontsize=9, fontweight='bold', ha='center')
    ax.text(17, 74, "12V Mains / Buck 5V / LDO 3.3V", fontsize=7, ha='center')

    # Microcontroller ESP32-S3 102
    ax.add_patch(patches.Rectangle((35, 30), 30, 54, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(63, 85, "102", fontsize=9, fontweight='bold')
    ax.text(50, 80, "ESP32-S3 MCU", fontsize=10, fontweight='bold', ha='center')
    ax.text(50, 76, "Dual-Core 240MHz", fontsize=8, ha='center')

    # TinyML & spoilLocked Box 114
    ax.add_patch(patches.Rectangle((37, 33), 26, 15, fill=False, edgecolor='black', linestyle='--'))
    ax.text(61, 49, "114", fontsize=8, fontweight='bold')
    ax.text(50, 43, "TINYML INT8 FLASH ENGINE", fontsize=8, fontweight='bold', ha='center')
    ax.text(50, 37, "spoilLocked [Bool Interlock]", fontsize=7, ha='center')

    # Pins
    pins_left = ["3V3 (VCC)", "GND", "GPIO8 (SCL)", "GPIO9 (SDA)", "GPIO4 (1-WIRE)", "GPIO5 (TRIG)", "GPIO6 (ECHO)"]
    y_pos = [72, 68, 62, 58, 52, 47, 43]
    for p, y in zip(pins_left, y_pos):
        ax.text(36, y, p, fontsize=6.5, family='monospace')

    ax.text(54, 65, "GPIO7 (ACTUATE)", fontsize=6.5, family='monospace')
    ax.text(56, 72, "5V VBUS", fontsize=6.5, family='monospace')

    # BME688 104
    ax.add_patch(patches.Rectangle((6, 52), 22, 14, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(26, 67, "104", fontsize=9, fontweight='bold')
    ax.text(17, 61, "BOSCH BME688", fontsize=9, fontweight='bold', ha='center')
    ax.text(17, 56, "VOC / Temp / RH / Pressure (I2C)", fontsize=7, ha='center')

    # DS18B20 106
    ax.add_patch(patches.Rectangle((6, 34), 22, 14, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(26, 49, "106", fontsize=9, fontweight='bold')
    ax.text(17, 43, "DS18B20 THERMISTOR", fontsize=9, fontweight='bold', ha='center')
    ax.text(17, 38, "Food Surface Temp (1-Wire)", fontsize=7, ha='center')

    # HC-SR04 108
    ax.add_patch(patches.Rectangle((6, 16), 22, 14, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(26, 31, "108", fontsize=9, fontweight='bold')
    ax.text(17, 25, "HC-SR04 ULTRASONIC", fontsize=9, fontweight='bold', ha='center')
    ax.text(17, 20, "Occupancy (<34cm PWM)", fontsize=7, ha='center')

    # Relay Circuit 110
    ax.add_patch(patches.Rectangle((72, 50), 22, 24, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(92, 75, "110", fontsize=9, fontweight='bold')
    ax.text(83, 68, "NPN RELAY DRIVER", fontsize=8, fontweight='bold', ha='center')
    ax.text(83, 63, "2N2222 Transistor / Rb 1kΩ", fontsize=7, ha='center')
    ax.text(83, 58, "Flyback Diode 1N4007", fontsize=7, ha='center')
    ax.text(83, 53, "Optocoupled Relay", fontsize=7, ha='center')

    # Solenoid Lock 112
    ax.add_patch(patches.Rectangle((72, 16), 22, 22, fill=False, edgecolor='black', linewidth=2.0))
    ax.text(92, 39, "112", fontsize=9, fontweight='bold')
    ax.text(83, 31, "12V SOLENOID LOCK", fontsize=9, fontweight='bold', ha='center')
    ax.text(83, 25, "FAIL-SECURE MECHANISM", fontsize=7, fontweight='bold', ha='center')
    ax.text(83, 19, "Normally Locked", fontsize=7, ha='center')

    # Lines
    ax.plot([28, 32, 32, 70, 70, 72], [77, 77, 88, 88, 62, 62], color='black', linewidth=1.5)
    ax.text(50, 89, "12V POWER RAIL", fontsize=7, fontweight='bold', ha='center')
    ax.plot([28, 31, 31, 35], [60, 60, 60, 60], color='black', linewidth=1.2)
    ax.plot([28, 33, 33, 35], [41, 41, 52, 52], color='black', linewidth=1.2)
    ax.plot([28, 34, 34, 35], [23, 23, 45, 45], color='black', linewidth=1.2)
    ax.plot([65, 72], [65, 65], color='black', linewidth=1.5)
    ax.plot([83, 83], [50, 38], color='black', linewidth=1.5)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "patent_figure_1_circuit_diagram.pdf"), format='pdf', dpi=300)
    plt.savefig(os.path.join(output_dir, "patent_figure_1_circuit_diagram.png"), format='png', dpi=300)
    plt.close()

def generate_fig2_architecture():
    fig, ax = plt.subplots(figsize=(11, 8.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    ax.text(50, 97, "FIG. 2", fontsize=16, fontweight='bold', ha='center')
    ax.text(50, 94, "FOUR-LAYER SYSTEM ARCHITECTURE", fontsize=11, fontstyle='italic', ha='center')
    ax.text(3, 91, "200", fontsize=9, fontweight='bold')

    # Layer 1 (202)
    ax.add_patch(patches.Rectangle((4, 70), 92, 19, fill=False, edgecolor='black', linewidth=1.5, linestyle='--'))
    ax.text(93, 87, "202", fontsize=8, fontweight='bold')
    ax.text(6, 86, "LAYER 1: HARDWARE NODE LAYER (EMBEDDED LOCAL EDGE)", fontsize=8, fontweight='bold')
    ax.add_patch(patches.Rectangle((6, 72), 20, 12, fill=False, edgecolor='black'))
    ax.text(16, 78, "SENSOR ARRAY\n(104-108)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((29, 72), 20, 12, fill=False, edgecolor='black'))
    ax.text(39, 78, "ESP32-S3 MCU\nTinyML Engine\n(102/210)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((52, 72), 20, 12, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(62, 78, "spoilLocked FLAG\nInterlock (114)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((75, 72), 19, 12, fill=False, edgecolor='black'))
    ax.text(84.5, 78, "SOLENOID LOCK\n12V Actuator (112)", fontsize=7, ha='center', va='center')

    # Layer 2 (204)
    ax.add_patch(patches.Rectangle((4, 53), 92, 13, fill=False, edgecolor='black', linewidth=1.5, linestyle='--'))
    ax.text(93, 64, "204", fontsize=8, fontweight='bold')
    ax.text(6, 63, "LAYER 2: COMMUNICATION & SECURE NETWORK BUS", fontsize=8, fontweight='bold')
    ax.add_patch(patches.Rectangle((25, 55), 50, 7, fill=False, edgecolor='black'))
    ax.text(50, 58.5, "IEEE 802.11 WiFi / TLS 1.3 Secure Transport Bus (212)", fontsize=7.5, ha='center', va='center')

    # Layer 3 (206)
    ax.add_patch(patches.Rectangle((4, 28), 92, 21, fill=False, edgecolor='black', linewidth=1.5, linestyle='--'))
    ax.text(93, 47, "206", fontsize=8, fontweight='bold')
    ax.text(6, 46, "LAYER 3: SPLIT-CLOUD DATABASE & AUDIT ARCHITECTURE", fontsize=8, fontweight='bold')

    ax.add_patch(patches.Rectangle((7, 30), 26, 13, fill=False, edgecolor='black'))
    ax.text(20, 36.5, "Firebase Realtime DB\nIoT Bus (216)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((37, 30), 26, 13, fill=False, edgecolor='black'))
    ax.text(50, 36.5, "Cloud Functions\nLogic Engine (218)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((67, 30), 26, 13, fill=False, edgecolor='black'))
    ax.text(80, 36.5, "Cloud Firestore\nAudit Store (220)", fontsize=7, ha='center', va='center')

    # Layer 4 (208)
    ax.add_patch(patches.Rectangle((4, 3), 92, 21, fill=False, edgecolor='black', linewidth=1.5, linestyle='--'))
    ax.text(93, 22, "208", fontsize=8, fontweight='bold')
    ax.text(6, 21, "LAYER 4: PROGRESSIVE WEB APPLICATION (PWA) OPERATIONAL ENGINES", fontsize=8, fontweight='bold')

    ax.add_patch(patches.Rectangle((6, 5), 21, 13, fill=False, edgecolor='black'))
    ax.text(16.5, 11.5, "Guard Engine\nIdentity Reg (222)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((29, 5), 21, 13, fill=False, edgecolor='black', linewidth=1.5))
    ax.text(39.5, 11.5, "Input Engine\nBiometric Gate (224)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((52, 5), 21, 13, fill=False, edgecolor='black'))
    ax.text(62.5, 11.5, "Intelligence Engine\nQuality Index (226)", fontsize=7, ha='center', va='center')

    ax.add_patch(patches.Rectangle((75, 5), 19, 13, fill=False, edgecolor='black'))
    ax.text(84.5, 11.5, "Command Engine\nAdmin Controls (228)", fontsize=7, ha='center', va='center')

    ax.annotate('', xy=(50, 70), xytext=(50, 66), arrowprops=dict(arrowstyle="->", lw=1.2))
    ax.annotate('', xy=(50, 53), xytext=(50, 49), arrowprops=dict(arrowstyle="->", lw=1.2))
    ax.annotate('', xy=(50, 28), xytext=(50, 24), arrowprops=dict(arrowstyle="->", lw=1.2))

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "patent_figure_2_system_architecture.pdf"), format='pdf', dpi=300)
    plt.savefig(os.path.join(output_dir, "patent_figure_2_system_architecture.png"), format='png', dpi=300)
    plt.close()

generate_fig1_circuit()
generate_fig2_architecture()
print("All figures generated successfully.")
