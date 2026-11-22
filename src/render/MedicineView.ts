import * as THREE from "three";

export function buildMedicine(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Shape();
  const x = .37, y = .25, r = .095;
  body.moveTo(-x + r, -y);
  body.lineTo(x - r, -y);
  body.quadraticCurveTo(x, -y, x, -y + r);
  body.lineTo(x, y - r);
  body.quadraticCurveTo(x, y, x - r, y);
  body.lineTo(-x + r, y);
  body.quadraticCurveTo(-x, y, -x, y - r);
  body.lineTo(-x, -y + r);
  body.quadraticCurveTo(-x, -y, -x + r, -y);
  const shell = new THREE.ExtrudeGeometry(body, { depth: .10, bevelEnabled: true, bevelSegments: 1,
    bevelSize: .018, bevelThickness: .018, curveSegments: 4 });
  shell.translate(0, 0, -.05);
  group.add(new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ color: 0xfff7ed })));
  const red = new THREE.MeshBasicMaterial({ color: 0xd92c3e });
  const upright = new THREE.PlaneGeometry(.086, .29);
  const crossbar = new THREE.PlaneGeometry(.29, .086);
  for (const side of [-1, 1]) {
    for (const geometry of [upright, crossbar]) {
      const piece = new THREE.Mesh(geometry, red);
      piece.position.z = side * .07;
      piece.rotation.y = side < 0 ? Math.PI : 0;
      group.add(piece);
    }
  }
  return group;
}
