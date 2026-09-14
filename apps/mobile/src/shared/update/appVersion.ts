import Constants from 'expo-constants';
import { ecobudApi } from '../api/ecobudApi';
import { compareAppVersions, isValidAppVersion } from './versionComparison';

export interface AppVersionInfo {
  latestVersion: string;
  minimumVersion: string;
  updateUrl: string;
}

export const getInstalledAppVersion = () =>
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null;

export const requiresMandatoryUpdate = (
  installedVersion: string,
  versionInfo: AppVersionInfo,
) => compareAppVersions(installedVersion, versionInfo.minimumVersion) < 0;

export const checkForMandatoryUpdate = async (): Promise<AppVersionInfo | null> => {
  const installedVersion = getInstalledAppVersion();
  if (!installedVersion || !isValidAppVersion(installedVersion)) return null;

  try {
    const versionInfo = await ecobudApi.fetchAppVersion();
    if (
      !isValidAppVersion(versionInfo.latestVersion) ||
      !isValidAppVersion(versionInfo.minimumVersion) ||
      typeof versionInfo.updateUrl !== 'string' ||
      !versionInfo.updateUrl.trim()
    ) {
      return null;
    }

    return requiresMandatoryUpdate(installedVersion, versionInfo) ? versionInfo : null;
  } catch {
    // A failed or timed-out check must never lock users out of the app.
    return null;
  }
};
