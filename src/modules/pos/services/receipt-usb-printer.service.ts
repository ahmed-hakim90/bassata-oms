import { buildEscPosReceiptBytes, type ReceiptPayload } from "@/modules/pos/services/receipt-format.service";

interface UsbEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: string;
}

interface UsbAlternateInterface {
  alternateSetting: number;
  endpoints: UsbEndpoint[];
}

interface UsbInterface {
  interfaceNumber: number;
  claimed: boolean;
  alternates: UsbAlternateInterface[];
}

interface UsbConfiguration {
  configurationValue: number;
  interfaces: UsbInterface[];
}

interface UsbDevice {
  opened: boolean;
  configuration: UsbConfiguration | null;
  configurations: UsbConfiguration[];
  open(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<unknown>;
}

interface UsbNavigator {
  getDevices(): Promise<UsbDevice[]>;
  requestDevice(options: { filters: Record<string, never>[] }): Promise<UsbDevice>;
}

type NavigatorWithUsb = Navigator & { usb?: UsbNavigator };

export class ReceiptPrinterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptPrinterError";
  }
}

function getUsb(): UsbNavigator {
  const usb = (navigator as NavigatorWithUsb).usb;
  if (!usb) {
    throw new ReceiptPrinterError("USB printing is not supported in this browser. Use Android Chrome or browser print.");
  }
  return usb;
}

async function findWritableEndpoint(device: UsbDevice) {
  if (!device.opened) {
    await device.open();
  }

  if (!device.configuration) {
    const configuration = device.configurations[0];
    if (!configuration) {
      throw new ReceiptPrinterError("The selected printer has no USB configuration.");
    }
    await device.selectConfiguration(configuration.configurationValue);
  }

  const configuration = device.configuration;
  if (!configuration) {
    throw new ReceiptPrinterError("Could not read the printer USB configuration.");
  }

  for (const usbInterface of configuration.interfaces) {
    const alternate = usbInterface.alternates[0];
    const endpoint = alternate?.endpoints.find((item) => item.direction === "out");
    if (!alternate || !endpoint) continue;

    if (!usbInterface.claimed) {
      await device.claimInterface(usbInterface.interfaceNumber);
    }

    return endpoint.endpointNumber;
  }

  throw new ReceiptPrinterError("No writable USB endpoint was found on the selected printer.");
}

export async function printReceiptViaUsb(payload: ReceiptPayload) {
  const usb = getUsb();
  const knownDevices = await usb.getDevices();
  const device = knownDevices[0] ?? (await usb.requestDevice({ filters: [{}] }));
  const endpointNumber = await findWritableEndpoint(device);
  await device.transferOut(endpointNumber, buildEscPosReceiptBytes(payload));
}
