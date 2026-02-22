import type { Position3D, Orientation3D, SpatialConfig } from './types';

const DEFAULTS: Required<SpatialConfig> = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 10000,
  rolloffFactor: 1,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
};

/** Create a PannerNode configured for 3D spatial audio. */
export function createPannerNode(
  context: BaseAudioContext,
  config?: SpatialConfig,
): PannerNode {
  const cfg = { ...DEFAULTS, ...config };
  const panner = context.createPanner();
  panner.panningModel = cfg.panningModel;
  panner.distanceModel = cfg.distanceModel;
  panner.refDistance = cfg.refDistance;
  panner.maxDistance = cfg.maxDistance;
  panner.rolloffFactor = cfg.rolloffFactor;
  panner.coneInnerAngle = cfg.coneInnerAngle;
  panner.coneOuterAngle = cfg.coneOuterAngle;
  panner.coneOuterGain = cfg.coneOuterGain;
  return panner;
}

/** Set 3D position on a PannerNode. */
export function setPannerPosition(panner: PannerNode, pos: Position3D): void {
  panner.positionX.value = pos[0];
  panner.positionY.value = pos[1];
  panner.positionZ.value = pos[2];
}

/** Create a StereoPannerNode for simple left/right panning. */
export function createStereoPanner(
  context: BaseAudioContext,
  pan?: number,
): StereoPannerNode {
  const panner = context.createStereoPanner();
  if (pan !== undefined) panner.pan.value = pan;
  return panner;
}

/** Set listener position and optional orientation on the AudioContext. */
export function setListenerTransform(
  listener: AudioListener,
  position: Position3D,
  orientation?: Orientation3D,
): void {
  listener.positionX.value = position[0];
  listener.positionY.value = position[1];
  listener.positionZ.value = position[2];
  if (orientation) {
    listener.forwardX.value = orientation[0];
    listener.forwardY.value = orientation[1];
    listener.forwardZ.value = orientation[2];
    listener.upX.value = orientation[3];
    listener.upY.value = orientation[4];
    listener.upZ.value = orientation[5];
  }
}
