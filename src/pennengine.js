import { Resource } from './resource';
import { order } from './order';
import { debug } from './debug';
import { zip } from './zip';
import * as Utils from './utils';

export const PennEngine = {
  Resource: Resource,
  debug: debug,
  order: order,
  utils: Utils,
  zip: zip
};
