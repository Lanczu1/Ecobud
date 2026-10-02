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

export const checkAppVersion = async (): Promise<AppVersionInfo | null | undefined> => {
  const installedVersion = getInstalledAppVersion();
  if (!installedVersion || !isValidAppVersion(installedVersion)) return undefined;

  try {
    const versionInfo = await ecobudApi.fetchAppVersion();
    if (
      !isValidAppVersion(versionInfo.latestVersion) ||
      !isValidAppVersion(versionInfo.minimumVersion) ||
      typeof versionInfo.updateUrl !== 'string' ||
      !versionInfo.updateUrl.trim()
    ) {
      return undefined;
    }

    return requiresMandatoryUpdate(installedVersion, versionInfo) ? versionInfo : null;
  } catch {
    // Unknown status must not clear a previously confirmed mandatory update.
    return undefined;
  }
};

export const checkForMandatoryUpdate = async (): Promise<AppVersionInfo | null> =>
  (await checkAppVersion()) ?? null;
