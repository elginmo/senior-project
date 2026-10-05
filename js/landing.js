import * as THREE from "three";

const landingScreen = document.getElementById("landing-screen");
const sceneContainer = document.getElementById("landing-scene");
const enterButton = document.getElementById("enter-button");
const statusMessage = document.getElementById("landing-status");
const replayButton = document.querySelector(".replay-intro");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const visitKey = "recHasVisited";
const hasVisited = document.documentElement.classList.contains("rec-has-visited");
let shouldMarkVisited = !hasVisited;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#090b10");
scene.fog = new THREE.Fog("#090b10", 12, 27);

const camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.set(0, 0, 16);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "low-power"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
sceneContainer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe5e9ff, 0x25212a, 2.2));

const keyLight = new THREE.DirectionalLight(0xffe8cf, 3.4);
keyLight.position.set(-5, 7, 10);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8ba8ff, 1.2);
fillLight.position.set(7, -4, 4);
scene.add(fillLight);

const formats = {
    cd: { width: 0.94, height: 0.94, depth: 0.075 },
    game: { width: 0.78, height: 1.12, depth: 0.14 },
    dvd: { width: 0.81, height: 1.16, depth: 0.105 },
    vinyl: { width: 1.2, height: 1.2, depth: 0.055 }
};

const caseFinishes = {
    cd: ["#8d9697", "#b0a18c", "#687780"],
    game: ["#183c35", "#262a45", "#514135"],
    dvd: ["#333540", "#242a30", "#4c3f3c"],
    vinyl: ["#35383d", "#574b42", "#384951"]
};

const mediaCases = [];
let animationStartedAt = performance.now();
let transitionStartedAt = null;
let animationFrame = 0;
let animationState = "idle";

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
}

function makeCase(formatName, index, angle) {
    const format = formats[formatName];
    const random = seededRandom(index * 139 + 47);
    const finishColors = caseFinishes[formatName];
    const finish = finishColors[Math.floor(random() * finishColors.length)];
    const caseMaterial = new THREE.MeshStandardMaterial({
        color: finish,
        roughness: 0.48,
        metalness: formatName === "cd" ? 0.18 : 0.06
    });
    const frontMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finish).lerp(new THREE.Color("#d9d3c5"), 0.12),
        roughness: 0.7,
        metalness: formatName === "cd" ? 0.08 : 0.02
    });
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(format.width, format.height, format.depth),
        [caseMaterial, caseMaterial, caseMaterial, caseMaterial, frontMaterial, caseMaterial]
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    const radius = 0.42 + random() * 0.12;
    const phase = random() * Math.PI * 2;
    const driftAngle = random() * Math.PI * 2;
    const homeRotation = new THREE.Euler(
        (random() - 0.5) * 0.34,
        (random() - 0.5) * 0.5,
        (random() - 0.5) * 0.42
    );
    const scale = 0.76 + random() * 0.42;

    group.scale.setScalar(scale);
    const screenX = Math.cos(angle) * radius;
    const screenY = Math.sin(angle) * radius;
    group.position.set(
        screenX * camera.aspect * 9.4 / 2,
        screenY * 9.4 / 2,
        -4.8 + random() * 8.1
    );
    group.rotation.copy(homeRotation);
    scene.add(group);

    mediaCases.push({
        group,
        baseX: group.position.x,
        baseY: group.position.y,
        baseZ: group.position.z,
        homeRotation,
        screenX,
        screenY,
        phase,
        driftAngle,
        drift: 0.025 + random() * 0.055,
        bob: 0.035 + random() * 0.08,
        spin: 0.035 + random() * 0.075,
        scale
    });
}

const formatSequence = ["vinyl", "game", "cd", "dvd", "game", "cd", "vinyl", "dvd"];
for (let index = 0; index < 16; index += 1) {
    const baseAngle = (index / 16) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.24;
    makeCase(formatSequence[index % formatSequence.length], index, baseAngle + jitter);
}

function makeDust() {
    const count = 170;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(881);
    for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (random() - 0.5) * 26;
        positions[index * 3 + 1] = (random() - 0.5) * 15;
        positions[index * 3 + 2] = -12 + random() * 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xc6c9d0,
        size: 0.018,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true
    });
    scene.add(new THREE.Points(geometry, material));
}

makeDust();

function resizeScene() {
    const width = sceneContainer.clientWidth;
    const height = sceneContainer.clientHeight;
    if (width === 0 || height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    for (const item of mediaCases) {
        item.baseX = item.screenX * camera.aspect * 9.4 / 2;
        item.baseY = item.screenY * 9.4 / 2;
    }
}

const resizeObserver = new ResizeObserver(resizeScene);
resizeObserver.observe(sceneContainer);
resizeScene();

function animate(now) {
    animationFrame = window.requestAnimationFrame(animate);
    const elapsed = (now - animationStartedAt) * 0.001;
    const motionScale = reducedMotion.matches ? 0.22 : 1;
    const transitionDuration = reducedMotion.matches ? 1050 : 2180;
    const progress = animationState !== "transition"
        ? 0
        : Math.min((now - transitionStartedAt) / transitionDuration, 1);

    for (const item of mediaCases) {
        const drift = Math.sin(elapsed * item.drift + item.phase) * motionScale;
        item.group.position.x = item.baseX + Math.cos(item.driftAngle) * drift * 0.24;
        item.group.position.y = item.baseY
            + Math.sin(item.driftAngle) * drift * 0.2
            + Math.sin(elapsed * 0.58 + item.phase) * item.bob * motionScale;
        item.group.position.z = item.baseZ + Math.sin(elapsed * 0.42 + item.phase) * 0.18 * motionScale;
        item.group.rotation.x = item.homeRotation.x + Math.sin(elapsed * item.spin + item.phase) * 0.065 * motionScale;
        item.group.rotation.y = item.homeRotation.y + Math.cos(elapsed * item.spin * 0.8 + item.phase) * 0.075 * motionScale;
        item.group.rotation.z = item.homeRotation.z + Math.sin(elapsed * item.spin + item.phase) * 0.045 * motionScale;

        if (animationState === "transition") {
            const outward = 1 + progress * progress * 2.6;
            item.group.position.x *= outward;
            item.group.position.y *= outward;
            item.group.position.z += progress * 15;
            item.group.scale.setScalar(item.scale * (1 + progress * 1.4));
        }
    }

    if (animationState === "transition" && progress >= 1) {
        finishEntrance();
    }

    renderer.render(scene, camera);
}

function startEntrance() {
    if (animationState === "transition") return;

    landingScreen.classList.remove("is-dismissed");
    landingScreen.classList.add("is-visible");
    landingScreen.classList.remove("is-entering");
    statusMessage.textContent = "";
    enterButton.disabled = false;
    enterButton.textContent = "ENTER";
    animationStartedAt = performance.now();
    transitionStartedAt = null;
    animationState = "idle";
}

function finishEntrance() {
    animationState = "complete";

    if (shouldMarkVisited) {
        try {
            localStorage.setItem(visitKey, "true");
            shouldMarkVisited = false;
        } catch (error) {
            console.error("Could not save the rec. visit preference:", error);
            statusMessage.textContent = "Your visit could not be saved. Enable local storage and try again.";
            startEntrance();
            return;
        }
    }

    landingScreen.classList.remove("is-visible");
    landingScreen.classList.add("is-dismissed");
    replayButton.focus();
}

enterButton.addEventListener("click", () => {
    if (animationState !== "idle") return;
    statusMessage.textContent = "";
    enterButton.disabled = true;
    enterButton.textContent = "ENTERING";
    transitionStartedAt = performance.now();
    animationStartedAt = transitionStartedAt;
    animationState = "transition";
    landingScreen.classList.add("is-entering");
});

replayButton.addEventListener("click", (event) => {
    event.preventDefault();
    startEntrance();
    enterButton.focus();
});

window.addEventListener("pagehide", () => {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    renderer.dispose();
});

animationFrame = window.requestAnimationFrame(animate);
enterButton.disabled = false;
