// ========== 星光粒子 ==========
let particles = [];
let centerX, centerY;
let reflowSpeed = 0;
let targetSpeed = 0;
let currentGesture = "None";
let stableGesture = "None";
let gestureHoldFrames = 0;

const stageTexts = [
  "初始状态：星光向外扩散，等待手势控制。",
  "手掌张开：星光冻结并缓慢回流。",
  "握拳：星光快速向中心汇聚。",
  "松手张开：回流减速。",
  "完全握拳：持续快速收回。",
  "手离开：星光暂停。"
];

class Particle {
  constructor() {
    this.originR = random(60, 260);
    this.angle = random(TWO_PI);
    this.r = this.originR;
    this.alpha = random(120, 220);
    this.size = random(1, 3.2);
  }
  reset() {
    this.r = this.originR;
    this.alpha = random(120, 220);
  }
  update(speedFactor) {
    this.r -= speedFactor;
    this.r = constrain(this.r, 0, this.originR);
    this.x = centerX + cos(this.angle) * this.r;
    this.y = centerY + sin(this.angle) * this.r;
  }
  show() {
    push();
    blendMode(ADD);
    fill(255, 225, 140, this.alpha);
    noStroke();
    circle(this.x, this.y, this.size);
    pop();
  }
}

function drawStar(cx, cy, r) {
  push();
  fill(255, 215, 120, 230);
  noStroke();
  beginShape();
  for (let i = 0; i < 5; i++) {
    let a = TWO_PI * (i * 2 / 5) - HALF_PI;
    let sx = cx + cos(a) * r;
    let sy = cy + sin(a) * r;
    vertex(sx, sy);
  }
  endShape(CLOSE);
  pop();
}

// ========== MediaPipe Hands 识别逻辑 ==========
let hands;
let video, canvasHand, ctxHand;

function setup() {
  let canvas = createCanvas(900, 600);
  canvas.parent("p5CanvasWrap");
  centerX = width / 2;
  centerY = height / 2;

  for (let i = 0; i < 800; i++) {
    particles.push(new Particle());
  }

  document.getElementById("resetBtn").onclick = resetAnimation;
  updateStageText();

  setTimeout(startHandDetect, 600);
}

function startHandDetect() {
  video = document.getElementById('videoInput');
  canvasHand = document.getElementById('handCanvas');
  ctxHand = canvasHand.getContext('2d');

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.4
  });

  hands.onResults(onHandResult);

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();
  document.getElementById("gestureText").innerText = "✅ 摄像头已开启";
}

function isFingerUp(lm, tipId, pipId) {
  return lm[tipId].y < lm[pipId].y - 0.03;
}

function onHandResult(results) {
  ctxHand.save();
  ctxHand.clearRect(0, 0, canvasHand.width, canvasHand.height);
  ctxHand.drawImage(results.image, 0, 0, canvasHand.width, canvasHand.height);

  let hasHand = results.multiHandLandmarks.length > 0;
  let fingerCount = 0;
  let gesture = "None";

  if (hasHand) {
    let lm = results.multiHandLandmarks[0];

    drawConnectors(ctxHand, lm, HAND_CONNECTIONS, { color: '#0ff', lineWidth: 2 });
    drawLandmarks(ctxHand, lm, { color: '#f0f', radius: 3 });

    if (isFingerUp(lm, 8, 6)) fingerCount++;
    if (isFingerUp(lm, 12, 10)) fingerCount++;
    if (isFingerUp(lm, 16, 14)) fingerCount++;
    if (isFingerUp(lm, 20, 18)) fingerCount++;

    // 张开手掌：3根以上手指伸直
    if (fingerCount >= 3) {
      gesture = "Open_Palm";
    }
    // 握拳：0~1根手指伸直
    else if (fingerCount <= 1) {
      gesture = "Closed_Fist";
    }
    // 半握/过渡手势：保持当前速度不突变
    else {
      gesture = stableGesture;
    }
  }

  ctxHand.restore();
  updateGestureUI(hasHand, gesture, fingerCount);
}

function updateGestureUI(hasHand, gesture, fingerCount) {
  const gestureDom = document.getElementById("gestureText");
  const titleDom = document.getElementById("modeTitle");
  const descDom = document.getElementById("modeDesc");
  const tipDom = document.getElementById("rightTip");

  // 手势防抖：连续稳定几帧才切换
  if (gesture === stableGesture) {
    gestureHoldFrames++;
  } else {
    gestureHoldFrames = 0;
    currentGesture = gesture;
  }

  if (gestureHoldFrames > 5) {
    stableGesture = currentGesture;
  }

  if (!hasHand) {
    gestureDom.innerText = "未检测到手";
    titleDom.innerText = "等待手势";
    descDom.innerText = "手离开画面，星光暂停回流。";
    tipDom.innerText = "请伸手控制星光";
    targetSpeed = 0;
  }
  else if (stableGesture === "Open_Palm") {
    gestureDom.innerText = "✅ 张开手掌 · 星光慢收";
    titleDom.innerText = "手势1 · 手掌张开";
    descDom.innerText = "手掌张开，星光减速并保持缓慢回流。";
    tipDom.innerText = "张开手 → 慢收";
    targetSpeed = 0.04;
  }
  else if (stableGesture === "Closed_Fist") {
    gestureDom.innerText = "✊ 握拳 · 星光快收";
    titleDom.innerText = "手势2 · 握拳";
    descDom.innerText = "握拳，星光快速向中心五角星汇聚。";
    tipDom.innerText = "握拳 → 快收";
    targetSpeed = 0.75;
  }
  else {
    gestureDom.innerText = "🖐 过渡中 · 保持当前速度";
    titleDom.innerText = "手势控制中";
    descDom.innerText = "手势未完全定型，星光保持当前回流速度。";
    tipDom.innerText = "完全张开或完全握拳";
  }
}

function draw() {
  background(7, 11, 34, 22);
  centerX = width / 2;
  centerY = height / 2;

  // 平滑过渡速度，避免忽快忽慢
  reflowSpeed = lerp(reflowSpeed, targetSpeed, 0.08);

  for (let p of particles) {
    p.update(reflowSpeed);
    p.show();
  }

  drawStar(centerX, centerY, 55);
}

function resetAnimation() {
  for (let p of particles) p.reset();
  reflowSpeed = 0;
  targetSpeed = 0;
  stableGesture = "None";
  currentGesture = "None";
  gestureHoldFrames = 0;
  updateStageText();
}

function updateStageText() {
  document.getElementById("stageText").innerText = stageTexts[0];
}