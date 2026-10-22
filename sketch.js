// ========== 星光粒子 ==========
let particles = [];
let centerX, centerY;
let reflowSpeed = 0;
let targetSpeed = 0;
let currentGesture = "None";
let stableGesture = "None";
let gestureHoldFrames = 0;

const stageTexts = [
  "初始状态：等待手势控制",
  "手掌张开：星光向外扩散",
  "握拳：星光向中心收拢",
  "手移出画面：星光静止"
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
    this.r += speedFactor;
    // 限制范围：不能小于0，不能超过原始半径
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

    // 张开手掌：3根以上手指伸直 → 扩散（正数）
    if (fingerCount >= 3) {
      gesture = "Open_Palm";
    }
    // 握拳：0~1根手指伸直 → 收拢（负数）
    else if (fingerCount <= 1) {
      gesture = "Closed_Fist";
    }
    // 半握过渡：保持当前状态
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

  // 手势防抖，防止闪烁
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
    descDom.innerText = "手离开画面，星光静止不动";
    tipDom.innerText = "伸手来控制星光";
    targetSpeed = 0;
  }
  else if (stableGesture === "Open_Palm") {
    gestureDom.innerText = "✅ 张开手掌 · 星光向外扩散";
    titleDom.innerText = "张开手掌";
    descDom.innerText = "手掌张开，粒子向外散开";
    tipDom.innerText = "张开手 → 扩散";
    targetSpeed = 0.06;
  }
  else if (stableGesture === "Closed_Fist") {
    gestureDom.innerText = "✊ 握拳 · 星光向中心收拢";
    titleDom.innerText = "握拳";
    descDom.innerText = "握拳，粒子快速向星星收进去";
    tipDom.innerText = "握拳 → 收拢";
    targetSpeed = -0.75;
  }
  else {
    gestureDom.innerText = "🖐 手势过渡中";
    titleDom.innerText = "过渡状态";
    descDom.innerText = "手势没有识别清楚，保持不动";
    tipDom.innerText = "完全张开或者握紧拳头";
    targetSpeed = 0;
  }
}

function draw() {
  background(7, 11, 34, 22);
  centerX = width / 2;
  centerY = height / 2;

  // 平滑变速
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