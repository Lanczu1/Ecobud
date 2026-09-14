export interface AppVersionConfig {
  latestVersion: string;
  minimumVersion: string;
  updateUrl: string;
}

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const readAppVersionConfig = (
  env: NodeJS.ProcessEnv = process.env,
): AppVersionConfig => {
  const latestVersion = env.APP_LATEST_VERSION?.trim() || '1.0.0';
  const minimumVersion = env.APP_MINIMUM_VERSION?.trim() || '1.0.0';
  const updateUrl = env.APP_UPDATE_URL?.trim() || 'ecobud://';

  if (!VERSION_PATTERN.test(latestVersion) || !VERSION_PATTERN.test(minimumVersion)) {
    throw new Error('APP_LATEST_VERSION and APP_MINIMUM_VERSION must be numeric versions such as 1.2.0.');
  }

  if (!updateUrl) {
    throw new Error('APP_UPDATE_URL must not be empty.');
  }

  return { latestVersion, minimumVersion, updateUrl };
};
