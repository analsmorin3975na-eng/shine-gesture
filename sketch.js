// ========== 星光粒子 ==========
let particles = [];
let centerX, centerY;
let stage = 0;
let stageTimer = 0;
let reflowSpeed = 0;

const stageTexts = [
  "初始状态（星光冻结）：星光向外扩散的粒子保持在空中，呈现完整的星光效果。",
  "开始汇聚：外层的星光粒子缓慢向中心移动，轨迹依然清晰可见。",
  "持续汇聚：更多的星光粒子沿原轨迹回流，逐渐靠近星体。",
  "加速回流：星光雨进一步收缩，粒子流动速度逐渐加快。",
  "接近中心：大部分粒子已回到星体附近，形成流动的光环。",
  "即将完全汇聚：最后的星光粒子缓缓回归，光环逐渐收缩。",
  "完全收回：所有星光粒子回到星体内部，外部不再有散落的光点。",
  "最终状态：仅剩中心的五角星，散发稳定的光芒。"
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
  for(let i=0; i<5; i++){
    let a = TWO_PI * (i*2/5) - HALF_PI;
    let sx = cx + cos(a)*r;
    let sy = cy + sin(a)*r;
    vertex(sx, sy);
  }
  endShape(CLOSE);
  pop();
}

// ========== MediaPipe Hands 识别逻辑 ==========
let hands;
let video, canvasHand, ctxHand;

function setup() {
  // p5画布优先渲染，星光先出来！
  let canvas = createCanvas(900, 600);
  canvas.parent("p5CanvasWrap");
  centerX = width / 2;
  centerY = height / 2;

  for(let i=0; i<800; i++){
    particles.push(new Particle());
  }
  document.getElementById("resetBtn").onclick = resetAnimation;
  updateStageText();

  // 延迟启动手势识别，不阻塞渲染
  setTimeout(startHandDetect, 600);
}

function startHandDetect(){
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
      await hands.send({image: video});
    },
    width:640,
    height:480
  });
  camera.start();
  document.getElementById("gestureText").innerText = "✅ 摄像头已开启";
}

function onHandResult(results){
  ctxHand.save();
  ctxHand.clearRect(0,0,canvasHand.width, canvasHand.height);
  ctxHand.drawImage(results.image,0,0,canvasHand.width,canvasHand.height);

  let hasHand = results.multiHandLandmarks.length > 0;
  let isOpen = false;
  let isFist = false;

  if(hasHand){
    let lm = results.multiHandLandmarks[0];
    drawConnectors(ctxHand, lm, HAND_CONNECTIONS, {color:'#0ff', lineWidth:2});
    drawLandmarks(ctxHand, lm, {color:'#f0f', radius:3});

    // 掌根
    let palm = lm[0];
    // 四个指尖
    let indexTip = lm[8];
    let midTip = lm[12];
    let ringTip = lm[16];
    let pinkyTip = lm[20];

    // 计算距离
    let d1 = dist(indexTip.x, indexTip.y, palm.x, palm.y);
    let d2 = dist(midTip.x, midTip.y, palm.x, palm.y);
    let d3 = dist(ringTip.x, ringTip.y, palm.x, palm.y);
    let d4 = dist(pinkyTip.x, pinkyTip.y, palm.x, palm.y);
    let avg = (d1+d2+d3+d4)/4;

    if(avg > 0.30){
      isOpen = true;
    }else if(avg < 0.17){
      isFist = true;
    }
  }
  ctxHand.restore();
  updateGestureUI(hasHand, isOpen, isFist);
}

function updateGestureUI(hasHand, isOpen, isFist){
  const gestureDom = document.getElementById("gestureText");
  const titleDom = document.getElementById("modeTitle");
  const descDom = document.getElementById("modeDesc");
  const tipDom = document.getElementById("rightTip");

  if(!hasHand){
    gestureDom.innerText = "未检测到手";
    reflowSpeed = 0;
  }else if(isOpen){
    gestureDom.innerText = "✅ 张开手掌（手势1）";
    titleDom.innerText = "手势1 · 手掌保持不动";
    descDom.innerText = "星光雨保持静止，缓慢汇聚";
    tipDom.innerText = "保持手掌静止 · 星光缓慢汇聚";
    reflowSpeed = 0.08;
  }else if(isFist){
    gestureDom.innerText = "✊ 握拳（手势2）";
    titleDom.innerText = "手势2 · 握拳快速回流";
    descDom.innerText = "握拳触发星光快速向中心汇聚";
    tipDom.innerText = "握拳 · 星光快速收回";
    reflowSpeed = 0.65;
  }else{
    gestureDom.innerText = "🖐 手势过渡中";
    reflowSpeed = 0.22;
  }
}

function draw() {
  background(7, 11, 34, 22);
  centerX = width / 2;
  centerY = height / 2;

  stageTimer += deltaTime;
  let stageDuration = reflowSpeed < 0.1 ? 1400 : 700;
  if(stageTimer > stageDuration && stage < 7) {
    stageTimer = 0;
    stage ++;
    updateStageText();
  }

  for(let p of particles) {
    p.update(reflowSpeed);
    p.show();
  }
  drawStar(centerX, centerY, 55);
}

function resetAnimation() {
  stage = 0;
  stageTimer = 0;
  for(let p of particles) p.reset();
  updateStageText();
}

function updateStageText() {
  document.getElementById("stageText").innerText = stageTexts[stage];
}