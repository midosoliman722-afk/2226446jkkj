import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// 1- المشهد
const scene = new THREE.Scene();

// 2- الكاميرا
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

// 3- محرك العرض
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

document.getElementById("scene").appendChild(renderer.domElement);

// ============================================================
// بيئة الانعكاسات (بدل RoomEnvironment عشان من غير import إضافي)
// أضواء ساطعة حوالين الألماسة = لمعان وانكسار حقيقي
// ============================================================
function createEnvironment() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x07080d);

    // [x, y, z, عرض, ارتفاع, شدة, لون]
    const panels = [
        [0, 7, 0, 6, 0.2, 14, 0xffffff],
        [6, 2, 3, 0.2, 4, 18, 0xffffff],
        [-6, 1, 3, 0.2, 4, 12, 0xbcd4ff],
        [3, -2, 6, 5, 0.2, 10, 0xffe2b0],
        [-4, 3, -6, 5, 3, 16, 0xffffff],
        [5, 4, -5, 2, 2, 22, 0xffc9a0],
        [-5, -3, 0, 0.2, 3, 8, 0xa8c0ff],
        [0, -6, -3, 6, 0.2, 6, 0xffffff],
        [2, 5, 5, 2, 0.2, 24, 0xffffff]
    ];

    panels.forEach(([x, y, z, w, h, intensity, col]) => {
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(col).multiplyScalar(intensity)
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w > 0.5 ? 1 : 4), mat);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        envScene.add(mesh);
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
    return envTexture;
}

scene.environment = createEnvironment();

// ===== نجوم واقعية =====
function createStarField(count, radius, sizeMin, sizeMax, flatten = 1, dim = 1) {
    const pos = [], col = [], sizes = [], phases = [];
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const r = radius * (0.7 + Math.random() * 0.3);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos.push(
            r * Math.sin(ph) * Math.cos(th),
            r * Math.sin(ph) * Math.sin(th) * flatten,
            r * Math.cos(ph)
        );

        // ألوان حقيقية حسب حرارة النجم
        const k = Math.random();
        if (k < 0.15)      c.setHSL(0.60, 0.65, 0.85);  // أزرق
        else if (k < 0.70) c.setHSL(0.10, 0.08, 0.95);  // أبيض
        else if (k < 0.90) c.setHSL(0.12, 0.50, 0.85);  // أصفر
        else               c.setHSL(0.05, 0.70, 0.75);  // برتقالي
        col.push(c.r * dim, c.g * dim, c.b * dim);

        // أغلب النجوم صغيرة وقليل منها كبير
        sizes.push(sizeMin + Math.pow(Math.random(), 6) * (sizeMax - sizeMin));
        phases.push(Math.random() * Math.PI * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('starColor', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPR: { value: renderer.getPixelRatio() }
        },
        vertexShader: `
            attribute vec3 starColor;
            attribute float aSize;
            attribute float aPhase;
            uniform float uTime;
            uniform float uPR;
            varying vec3 vColor;
            varying float vTw;
            void main() {
                vColor = starColor;
                vTw = 0.7 + 0.3 * sin(uTime * (1.0 + aPhase * 0.3) + aPhase * 6.28);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uPR * (120.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vTw;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float a = pow(smoothstep(0.5, 0.0, d), 2.2);
                gl_FragColor = vec4(vColor * vTw, a * vTw);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    return new THREE.Points(geo, mat);
}

const stars = createStarField(3500, 40, 0.6, 3.2);
const starsBlue = createStarField(250, 38, 2.0, 4.5);                 // نجوم لامعة قليلة
const milkyWay = createStarField(4000, 45, 0.3, 0.9, 0.12, 0.3);     // مجرة درب التبانة
milkyWay.rotation.z = 0.6;
scene.add(stars, starsBlue, milkyWay);

// خلفية فضاء متدرجة
const bgCanvas = document.createElement('canvas');
bgCanvas.width = 2; bgCanvas.height = 512;
const bctx = bgCanvas.getContext('2d');
const bg = bctx.createLinearGradient(0, 0, 0, 512);
bg.addColorStop(0, '#02030a');
bg.addColorStop(0.5, '#070b1c');
bg.addColorStop(1, '#0e0a1c');
bctx.fillStyle = bg;
bctx.fillRect(0, 0, 2, 512);
const bgTex = new THREE.CanvasTexture(bgCanvas);
bgTex.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTex;

// شهاب
const shootGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.2, 0.5, 0)
]);
shootGeo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3));
const shooting = new THREE.Line(shootGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
}));
shooting.visible = false;
scene.add(shooting);
let nextShot = 3, shotT = -1;

// ============================================================
// الخاتم
// ============================================================
const ringGeometry = new THREE.BufferGeometry();
const ringPositions = [];
const ringColors = [];
const particleCount = 4276;

for (let i = 0; i < particleCount; i++) {

    const angle = Math.random() * Math.PI * 2;
    const tubeAngle = Math.random() * Math.PI * 2;

    const radius = 1.45 + 0.12 * Math.cos(tubeAngle);

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = Math.sin(tubeAngle) * 0.12;

    ringPositions.push(x, y, z);

    const gold = new THREE.Color();
   gold.setHSL(0.6, 0.06, 0.22 + Math.random() * 0.14);
    ringColors.push(gold.r, gold.g, gold.b);
}

ringGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(ringPositions, 3)
);
ringGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(ringColors, 3)
);

const ringMaterial = new THREE.PointsMaterial({
    size: 0.022,
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const ring = new THREE.Points(ringGeometry, ringMaterial);

// ============================================================
// الألماسة (قطع Brilliant: تاج + حزام + قاعدة مدببة)
// ============================================================
// جسم الخاتم الصلب (بيقفل كل الفراغات)
const solidRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.115, 24, 160),
    new THREE.MeshStandardMaterial({
        color: 0x5a5f66,        // سيلفر غامق
        metalness: 1,
        roughness: 0.28,
        envMapIntensity: 1.6
    })
);
ring.add(solidRing);
const diamondProfile = [
    new THREE.Vector2(0.0, -0.36),   // رأس القاعدة
    new THREE.Vector2(0.42, 0.0),    // الحزام (أوسع نقطة)
    new THREE.Vector2(0.42, 0.015),
    new THREE.Vector2(0.34, 0.09),   // أوجه التاج
    new THREE.Vector2(0.24, 0.15),   // حافة السطح العلوي
    new THREE.Vector2(0.0, 0.15)     // السطح العلوي (table)
];

const diamondGeometry = new THREE.LatheGeometry(diamondProfile, 12);

const diamondMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9bb8ff,
    metalness: 0.35,
    roughness: 0.03,
    transmission: 0.25,       // كان 1: شفافية أقل بكتير
    thickness: 2,
    ior: 2.33,
    clearcoat: 1,
    clearcoatRoughness: 0,
    iridescence: 0.4,
    iridescenceIOR: 1.8,
    envMapIntensity: 8,       // انعكاسات أقوى = أوجه أوضح
    emissive: 0x3a58ff,       // لون أزرق من جوه
    emissiveIntensity: 0.1,
    flatShading: true,
    side: THREE.FrontSide     // كان DoubleSide
});

const diamond = new THREE.Mesh(diamondGeometry, diamondMaterial);

// مجموعة الألماسة: مكانها فوق الخاتم
const diamondGroup = new THREE.Group();
diamondGroup.position.set(0, 1.93, 0);
diamondGroup.add(diamond);
// ===== القاعدة الدهبية (4 مخالب بتمسك الألماسة) =====
const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdfe4ea,
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 2.5
});

// المخالب
for (let i = 0; i < 4; i++) {
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.014, -0.44, 0),
        new THREE.Vector3(0.07, -0.34, 0),
        new THREE.Vector3(0.24, -0.18, 0),
        new THREE.Vector3(0.38, -0.05, 0),
        new THREE.Vector3(0.45, 0.015, 0),
        new THREE.Vector3(0.37, 0.08, 0)   // الطرف بينحني فوق الألماسة
    ]);

    const prong = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.022, 8, false),
        goldMat
    );
    prong.rotation.y = (Math.PI / 2) * i + Math.PI / 4;
    diamondGroup.add(prong);
}

// حلقة الربط
const rail = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.015, 8, 48),
    goldMat
);
rail.rotation.x = Math.PI / 2;
rail.position.y = -0.13;
diamondGroup.add(rail);

// القاعدة اللي بتوصل للخاتم
const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.11, 0.1, 24),
    goldMat
);
base.position.y = -0.45;
diamondGroup.add(base);
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 128;
const gctx = glowCanvas.getContext('2d');
const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(160,190,255,1)');
grad.addColorStop(0.3, 'rgba(90,120,255,0.35)');
grad.addColorStop(1, 'rgba(0,0,0,0)');
gctx.fillStyle = grad;
gctx.fillRect(0, 0, 128, 128);

const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.6
}));
glow.scale.set(2.2, 2.2, 1);
diamondGroup.add(glow);

// ============================================================
// مجموعة واحدة: الخاتم + الألماسة (بيلفوا مع بعض)
// ============================================================
const ringAssembly = new THREE.Group();
ringAssembly.add(ring);
ringAssembly.add(diamondGroup);
scene.add(ringAssembly);

// ============================================================
// الجزيئات الدهبية
// ============================================================
const sparkleGroup = new THREE.Group();
const sparkleCount = 1200;
const sparklePositions = [];

for (let i = 0; i < sparkleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.7 + Math.random() * 1.2;

    sparklePositions.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (Math.random() - 0.5) * 2
    );
}

const sparkleGeometry = new THREE.BufferGeometry();
sparkleGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(sparklePositions, 3)
);

const sparkleMaterial = new THREE.PointsMaterial({
    color: 0xffd36a,
    size: 0.025,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
sparkleGroup.add(sparkles);
scene.add(sparkleGroup);

// 6- التحريك
const movingLight = new THREE.PointLight(0xaec8ff, 40, 10);
scene.add(movingLight);

let mx = 0, my = 0;
window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
    ringAssembly.rotation.x = 0.6;   // ميلة ثابتة بتبيّن شكل الخاتم 3D
});
function animate() {

    requestAnimationFrame(animate);
    const t = performance.now() * 0.001;

// الضوء بيلف حوالين الألماسة
movingLight.position.set(Math.cos(t) * 2.5, 2 + Math.sin(t * 1.3), 2.5);

// الهالة بتنبض
glow.material.opacity = 0.5 + Math.sin(t * 2) * 0.15;

// الخاتم بيطفو لفوق وتحت بنعومة
ringAssembly.position.y = Math.sin(t) * 0.08;

// الكاميرا بتتحرك مع الماوس
camera.position.x += (mx * 0.8 - camera.position.x) * 0.05;
camera.position.y += (-my * 0.5 - camera.position.y) * 0.05;
camera.lookAt(0, 0, 0);

    stars.rotation.y += 0.0005;
    stars.rotation.x += 0.0002;

    // الخاتم + الألماسة بيلفوا مع بعض
    ringAssembly.rotation.y += 0.003;
    
    // لفة خفيفة للألماسة حوالين نفسها (عشان اللمعان يتغير)
    diamond.rotation.y += 0.008;

    sparkleGroup.rotation.y += 0.0008;
    sparkleGroup.rotation.x += 0.0003;

    sparkleMaterial.opacity = 0.5 + Math.random() * 0.4;

    renderer.render(scene, camera);
}

animate();

// 7- ضبط الشاشة
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});