import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: false,
  ...environmentSecrets
};