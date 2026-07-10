import { assetVersions } from '../../environments/asset-versions.generated';

export function versionedImageSvgUrl(path: string): string {
  return `${path}?v=${assetVersions.imageSvgVersion}`;
}
