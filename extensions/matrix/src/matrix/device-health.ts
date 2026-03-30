export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleKlawtyDevices: MatrixManagedDeviceInfo[];
  currentKlawtyDevices: MatrixManagedDeviceInfo[];
};

const KLAWTY_DEVICE_NAME_PREFIX = "Klawty ";

export function isKlawtyManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(KLAWTY_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const klawtyDevices = devices.filter((device) => isKlawtyManagedMatrixDevice(device.displayName));
  return {
    currentDeviceId,
    staleKlawtyDevices: klawtyDevices.filter((device) => !device.current),
    currentKlawtyDevices: klawtyDevices.filter((device) => device.current),
  };
}
