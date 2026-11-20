import type { buildCharacter } from "./CharacterView";
import type { MeleePose } from "../systems/MeleeSystem";

type Rig = ReturnType<typeof buildCharacter>;
const smooth = (t: number) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};

export function poseCharacter(rig: Rig, stride: number, pose?: MeleePose): void {
  const { limbs: [leftLeg, leftArm, rightLeg, rightArm], joints: [leftKnee, leftElbow, rightKnee, rightElbow], torso } = rig;
  torso.rotation.set(0, 0, 0);
  torso.position.z = 0;
  [leftLeg, leftArm, rightLeg, rightArm].forEach((limb, i) => {
    limb.rotation.set((i === 0 || i === 3) ? stride : -stride, 0, 0);
  });
  for (const joint of rig.joints) joint.rotation.set(0, 0, 0);
  if (!pose) return;
  torso.rotation.x += pose.flinch * .28;
  torso.rotation.z -= pose.flinch * .15;
  if (pose.move < 0) {
    leftArm.rotation.x += pose.flinch * .4;
    rightArm.rotation.x += pose.flinch * .48;
    return;
  }

  const kick = pose.move === 2;
  const right = pose.move !== 1;
  const sign = right ? 1 : -1;
  const t = pose.progress;
  const strike = kick ? .52 : pose.move === 1 ? .50 : .44;
  const coil = smooth(t / (strike * .63)) * (1 - smooth((t - strike * .63) / (strike * .37)));
  const extension = smooth((t - strike * .63) / (strike * .37)) * (1 - smooth((t - strike) / (1 - strike)));
  const guard = smooth(t / .12) * (1 - smooth((t - .78) / .22));
  torso.rotation.y = sign * (.42 * coil - .56 * extension);
  torso.rotation.x += kick ? .23 * extension - .13 * coil : -.22 * extension + .09 * coil;
  torso.rotation.z -= sign * (kick ? .16 : .10) * extension;
  torso.position.z = -.13 * extension + .065 * coil;
  leftArm.rotation.x = .83 * guard;
  rightArm.rotation.x = .91 * guard;
  leftArm.rotation.z = -.16 * guard;
  rightArm.rotation.z = .16 * guard;
  leftElbow.rotation.x = 1.26 * guard;
  rightElbow.rotation.x = 1.28 * guard;
  leftLeg.rotation.x = .13 * guard + .18 * extension;
  rightLeg.rotation.x = -.12 * guard;
  leftKnee.rotation.x = -.14 * guard;
  rightKnee.rotation.x = -.14 * guard;
  if (kick) {
    rightLeg.rotation.x = 1.14 * coil + 1.48 * extension;
    rightLeg.rotation.z = .16 * extension;
    rightKnee.rotation.x = -1.48 * coil - .15 * extension;
    leftArm.rotation.x += .25 * coil;
    rightArm.rotation.x -= .95 * extension;
  } else {
    const [arm, elbow] = right ? [rightArm, rightElbow] : [leftArm, leftElbow];
    arm.rotation.x += -.43 * coil + .57 * extension;
    arm.rotation.y = -sign * .23 * extension;
    arm.rotation.z += sign * (.22 * coil - .12 * extension);
    elbow.rotation.x += .36 * coil - 1.19 * extension;
  }
}
