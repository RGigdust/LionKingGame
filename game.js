// ============================================
// 🎮 محرك اللعبة الواقعي
// ============================================

// إعدادات اللعبة
const CONFIG = {
    // حجم العالم
    WORLD_WIDTH: 300, // % من الشاشة
    WORLD_HEIGHT: 300,
    
    // مراحل التطور
    STAGES: {
        CUB: { name: 'شبل صغير', icon: '🐾', size: 10, speed: 2, huntRange: 80 },
        TEEN: { name: 'شبل مراهق', icon: '🦁', size: 12, speed: 3, huntRange: 100 },
        YOUNG: { name: 'أسد شاب', icon: '🦁', size: 14, speed: 4, huntRange: 120 },
        KING: { name: 'ملك الغابة', icon: '👑', size: 16, speed: 5, huntRange: 150 }
    },
    
    // الفرائس
    PREY: {
        HAMSTER: { icon: '🐹', zaar: 5, last: 0.001, speed: 2, size: 4 },
        RABBIT: { icon: '🐰', zaar: 10, last: 0.002, speed: 3, size: 4 },
        DEER: { icon: '🦌', zaar: 25, last: 0.005, speed: 4, size: 5 },
        BOAR: { icon: '🐗', zaar: 50, last: 0.01, speed: 2.5, size: 5 }
    },
    
    // الحفر
    DIG_DURATION: 3000, // 3 ثوان
    DIG_REWARD_MIN: 2,
    DIG_REWARD_MAX: 8,
    
    // دورة الليل والنهار
    DAY_NIGHT_CYCLE: 120000, // 2 دقيقة = يوم كامل
    
    // ظهور الفرائس
    PREY_SPAWN_INTERVAL: 5000,
    MAX_PREY: 8,
    
    // تحويل العملة
    ZAAR_TO_LAST: 100,
};

// ============================================
// 🎯 حالة اللعبة
// ============================================
class GameState {
    constructor() {
        this.player = {
            x: 50, // % من عرض العالم
            y: 50, // % من ارتفاع العالم
            stage: 'CUB',
            zaar: 0,
            last: 0,
            totalHunts: 0,
            totalDigs: 0,
        };
        
        this.camera = {
            x: 0,
            y: 0,
        };
        
        this.world = {
            isDay: true,
            timeProgress: 0, // 0-1
        };
        
        this.prey = [];
        this.digSpots = [];
        this.trees = [];
        
        this.input = {
            isDragging: false,
            startX: 0,
            startY: 0,
        };
        
        this.modes = {
            digging: false,
        };
        
        this.loadFromStorage();
        this.generateWorld();
    }
    
    loadFromStorage() {
        const saved = localStorage.getItem('lastGameRealistic');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.player = { ...this.player, ...data.player };
            } catch (e) {
                console.error('Failed to load:', e);
            }
        }
    }
    
    save() {
        localStorage.setItem('lastGameRealistic', JSON.stringify({
            player: this.player,
        }));
    }
    
    // توليد عالم اللعبة
    generateWorld() {
        // توليد الأشجار
        for (let i = 0; i < 50; i++) {
            this.trees.push({
                x: Math.random() * CONFIG.WORLD_WIDTH,
                y: Math.random() * CONFIG.WORLD_HEIGHT,
                type: Math.random() > 0.5 ? '🌲' : '🌳',
            });
        }
        
        // توليد أماكن الحفر
        for (let i = 0; i < 20; i++) {
            this.digSpots.push({
                x: Math.random() * CONFIG.WORLD_WIDTH,
                y: Math.random() * CONFIG.WORLD_HEIGHT,
                dug: false,
            });
        }
    }
    
    // إضافة زار
    addZaar(amount) {
        this.player.zaar += amount;
        
        // تحويل تلقائي
        if (this.player.zaar >= CONFIG.ZAAR_TO_LAST) {
            const lastToAdd = Math.floor(this.player.zaar / CONFIG.ZAAR_TO_LAST);
            this.player.last += lastToAdd;
            this.player.zaar -= lastToAdd * CONFIG.ZAAR_TO_LAST;
        }
        
        this.save();
    }
    
    // التحقق من التطور
    canEvolve() {
        const stages = Object.keys(CONFIG.STAGES);
        const currentIndex = stages.indexOf(this.player.stage);
        
        if (currentIndex >= stages.length - 1) return false;
        
        const requirements = [0, 50, 200, 500]; // زار مطلوب لكل مرحلة
        return this.player.zaar >= requirements[currentIndex + 1];
    }
}

// ============================================
// 🎬 محرك الرسومات
// ============================================
class Renderer {
    constructor(gameState) {
        this.state = gameState;
        
        this.gameWorld = document.getElementById('gameWorld');
        this.camera = document.getElementById('camera');
        this.character = document.getElementById('character');
        this.skyLayer = document.getElementById('skyLayer');
        this.celestialBody = document.getElementById('celestialBody');
        this.stars = document.getElementById('stars');
        
        this.treesContainer = document.getElementById('treesBackground');
        this.preyContainer = document.getElementById('preyContainer');
        this.digSpotsContainer = document.getElementById('digSpotsContainer');
        
        this.init();
    }
    
    init() {
        // رسم الأشجار
        this.state.trees.forEach(tree => {
            const treeEl = document.createElement('div');
            treeEl.className = 'tree';
            treeEl.textContent = tree.type;
            treeEl.style.left = tree.x + '%';
            treeEl.style.top = tree.y + '%';
            treeEl.style.animationDelay = Math.random() * 2 + 's';
            this.treesContainer.appendChild(treeEl);
        });
        
        // رسم أماكن الحفر
        this.state.digSpots.forEach((spot, i) => {
            const spotEl = document.createElement('div');
            spotEl.className = 'dig-spot';
            spotEl.dataset.index = i;
            spotEl.style.left = spot.x + '%';
            spotEl.style.top = spot.y + '%';
            this.digSpotsContainer.appendChild(spotEl);
        });
        
        // رسم النجوم
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.textContent = '✨';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 50 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            this.stars.appendChild(star);
        }
    }
    
    // تحديث موضع الشخصية
    updateCharacterPosition() {
        this.character.style.left = this.state.player.x + '%';
        this.character.style.top = this.state.player.y + '%';
        
        const stage = CONFIG.STAGES[this.state.player.stage];
        this.character.style.fontSize = stage.size + 'em';
    }
    
    // تحديث الكاميرا
    updateCamera() {
        // الكاميرا تتبع الشخصية
        const targetX = -(this.state.player.x - 50);
        const targetY = -(this.state.player.y - 50);
        
        this.state.camera.x += (targetX - this.state.camera.x) * 0.1;
        this.state.camera.y += (targetY - this.state.camera.y) * 0.1;
        
        this.gameWorld.style.transform = `translate(${this.state.camera.x}%, ${this.state.camera.y}%)`;
    }
    
    // رسم فريسة
    spawnPrey(prey, index) {
        const preyEl = document.createElement('div');
        preyEl.className = 'prey';
        preyEl.textContent = prey.icon;
        preyEl.dataset.index = index;
        preyEl.style.left = prey.x + '%';
        preyEl.style.top = prey.y + '%';
        preyEl.style.fontSize = prey.size + 'em';
        
        this.preyContainer.appendChild(preyEl);
        return preyEl;
    }
    
    // تحديث موضع الفريسة
    updatePreyPosition(index) {
        const prey = this.state.prey[index];
        if (!prey || !prey.element) return;
        
        prey.element.style.left = prey.x + '%';
        prey.element.style.top = prey.y + '%';
    }
    
    // تحديث دورة النهار/الليل
    updateDayNightCycle() {
        const isDay = this.state.world.isDay;
        
        if (isDay) {
            this.skyLayer.className = 'sky-layer day';
            this.celestialBody.textContent = '☀️';
            this.celestialBody.classList.remove('moon');
            this.stars.classList.remove('visible');
            document.getElementById('timeDisplay').textContent = '☀️';
        } else {
            this.skyLayer.className = 'sky-layer night';
            this.celestialBody.textContent = '🌙';
            this.celestialBody.classList.add('moon');
            this.stars.classList.add('visible');
            document.getElementById('timeDisplay').textContent = '🌙';
        }
    }
    
    // تحديث واجهة المستخدم
    updateHUD() {
        document.getElementById('zaarDisplay').textContent = Math.floor(this.state.player.zaar);
        document.getElementById('lastDisplay').textContent = this.state.player.last.toFixed(3);
        
        const stage = CONFIG.STAGES[this.state.player.stage];
        document.getElementById('stageDisplay').innerHTML = `${stage.icon} ${stage.name}`;
        
        this.character.textContent = stage.icon;
    }
}

// ============================================
// 🎮 نظام الإدخال والحركة
// ============================================
class InputController {
    constructor(gameState, renderer) {
        this.state = gameState;
        this.renderer = renderer;
        this.character = document.getElementById('character');
        
        this.setupListeners();
    }
    
    setupListeners() {
        // التحكم باللمس
        this.character.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.character.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.character.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // التحكم بالماوس
        this.character.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    onTouchStart(e) {
        e.preventDefault();
        this.state.input.isDragging = true;
        const touch = e.touches[0];
        this.state.input.startX = touch.clientX;
        this.state.input.startY = touch.clientY;
        this.state.input.lastX = this.state.player.x;
        this.state.input.lastY = this.state.player.y;
    }
    
    onTouchMove(e) {
        if (!this.state.input.isDragging) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaX = (touch.clientX - this.state.input.startX) / window.innerWidth * 100;
        const deltaY = (touch.clientY - this.state.input.startY) / window.innerHeight * 100;
        
        this.moveCharacter(deltaX, deltaY);
        this.character.classList.add('moving');
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        this.state.input.isDragging = false;
        this.character.classList.remove('moving');
    }
    
    onMouseDown(e) {
        e.preventDefault();
        this.state.input.isDragging = true;
        this.state.input.startX = e.clientX;
        this.state.input.startY = e.clientY;
        this.state.input.lastX = this.state.player.x;
        this.state.input.lastY = this.state.player.y;
    }
    
    onMouseMove(e) {
        if (!this.state.input.isDragging) return;
        
        const deltaX = (e.clientX - this.state.input.startX) / window.innerWidth * 100;
        const deltaY = (e.clientY - this.state.input.startY) / window.innerHeight * 100;
        
        this.moveCharacter(deltaX, deltaY);
        this.character.classList.add('moving');
    }
    
    onMouseUp(e) {
        this.state.input.isDragging = false;
        this.character.classList.remove('moving');
    }
    
    moveCharacter(deltaX, deltaY) {
        const stage = CONFIG.STAGES[this.state.player.stage];
        const speed = stage.speed;
        
        this.state.player.x = Math.max(5, Math.min(CONFIG.WORLD_WIDTH - 5, 
            this.state.input.lastX + deltaX * speed));
        this.state.player.y = Math.max(5, Math.min(CONFIG.WORLD_HEIGHT - 5, 
            this.state.input.lastY + deltaY * speed));
        
        this.renderer.updateCharacterPosition();
    }
}

// ============================================
// 🦌 نظام الذكاء الاصطناعي للفرائس
// ============================================
class PreyAI {
    constructor(gameState, renderer) {
        this.state = gameState;
        this.renderer = renderer;
    }
    
    // توليد فريسة جديدة
    spawn() {
        if (this.state.prey.length >= CONFIG.MAX_PREY) return;
        
        const types = Object.entries(CONFIG.PREY);
        const [type, data] = types[Math.floor(Math.random() * types.length)];
        
        const prey = {
            type,
            icon: data.icon,
            x: Math.random() * CONFIG.WORLD_WIDTH,
            y: Math.random() * CONFIG.WORLD_HEIGHT,
            vx: (Math.random() - 0.5) * data.speed,
            vy: (Math.random() - 0.5) * data.speed,
            size: data.size,
            zaar: data.zaar,
            last: data.last,
            speed: data.speed,
            scared: false,
        };
        
        const index = this.state.prey.length;
        this.state.prey.push(prey);
        prey.element = this.renderer.spawnPrey(prey, index);
        
        // إضافة حدث الصيد
        prey.element.onclick = () => this.hunt(index);
    }
    
    // تحديث حركة الفرائس
    update() {
        this.state.prey.forEach((prey, index) => {
            if (!prey) return;
            
            // حساب المسافة من الشخصية
            const dx = this.state.player.x - prey.x;
            const dy = this.state.player.y - prey.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const stage = CONFIG.STAGES[this.state.player.stage];
            const fearDistance = stage.huntRange * 0.5;
            
            // الهروب من الشخصية
            if (distance < fearDistance) {
                prey.scared = true;
                prey.vx = -(dx / distance) * prey.speed * 2;
                prey.vy = -(dy / distance) * prey.speed * 2;
                prey.element.classList.add('running');
            } else {
                prey.scared = false;
                prey.element.classList.remove('running');
                
                // حركة عشوائية
                if (Math.random() < 0.02) {
                    prey.vx = (Math.random() - 0.5) * prey.speed;
                    prey.vy = (Math.random() - 0.5) * prey.speed;
                }
            }
            
            // تحديث الموضع
            prey.x += prey.vx * 0.1;
            prey.y += prey.vy * 0.1;
            
            // حدود الخريطة
            if (prey.x < 0 || prey.x > CONFIG.WORLD_WIDTH) prey.vx *= -1;
            if (prey.y < 0 || prey.y > CONFIG.WORLD_HEIGHT) prey.vy *= -1;
            
            prey.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH, prey.x));
            prey.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT, prey.y));
            
            this.renderer.updatePreyPosition(index);
        });
    }
    
    // صيد الفريسة
    hunt(index) {
        const prey = this.state.prey[index];
        if (!prey) return;
        
        // حساب المسافة
        const dx = this.state.player.x - prey.x;
        const dy = this.state.player.y - prey.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const stage = CONFIG.STAGES[this.state.player.stage];
        
        if (distance > stage.huntRange) {
            showOwlMessage('⚠️ الفريسة بعيدة! اقترب أكثر');
            return;
        }
        
        // نجح الصيد
        prey.element.classList.add('caught');
        document.getElementById('character').classList.add('hunting');
        
        setTimeout(() => {
            document.getElementById('character').classList.remove('hunting');
        }, 500);
        
        // المكافأة
        this.state.addZaar(prey.zaar);
        this.state.player.last += prey.last;
        this.state.player.totalHunts++;
        
        // جزيئات
        createParticles(prey.x, prey.y, '⚛️', 8);
        
        // حذف الفريسة
        setTimeout(() => {
            if (prey.element && prey.element.parentElement) {
                prey.element.remove();
            }
            this.state.prey[index] = null;
        }, 800);
        
        // عرض المكافأة
        showReward({
            icon: prey.icon,
            title: 'صيد رائع!',
            zaar: prey.zaar,
            last: prey.last.toFixed(3),
        });
        
        this.state.save();
    }
}

// ============================================
// ⛏️ نظام الحفر
// ============================================
class DiggingSystem {
    constructor(gameState, renderer) {
        this.state = gameState;
        this.renderer = renderer;
        this.isDigging = false;
    }
    
    // تفعيل وضع الحفر
    toggleMode() {
        this.state.modes.digging = !this.state.modes.digging;
        
        const digBtn = document.getElementById('digBtn');
        const spots = document.querySelectorAll('.dig-spot');
        
        if (this.state.modes.digging) {
            digBtn.classList.add('active');
            digBtn.textContent = '✅ جاهز للحفر';
            
            // إظهار أماكن الحفر القريبة
            spots.forEach((spot, i) => {
                const digSpot = this.state.digSpots[i];
                if (!digSpot.dug) {
                    const dx = this.state.player.x - digSpot.x;
                    const dy = this.state.player.y - digSpot.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 30) {
                        spot.classList.add('active');
                        spot.onclick = () => this.dig(i);
                    }
                }
            });
            
            showOwlMessage('🦉 اضغط على البقع البنية للحفر!');
        } else {
            digBtn.classList.remove('active');
            digBtn.textContent = '⛏️ حفر';
            spots.forEach(spot => {
                spot.classList.remove('active');
                spot.onclick = null;
            });
        }
    }
    
    // الحفر
    async dig(index) {
        if (this.isDigging) return;
        
        const spot = this.state.digSpots[index];
        if (spot.dug) return;
        
        const spotEl = document.querySelector(`.dig-spot[data-index="${index}"]`);
        
        this.isDigging = true;
        const character = document.getElementById('character');
        character.classList.add('digging');
        
        // جزيئات التراب
        const digInterval = setInterval(() => {
            createDirtParticles(spot.x, spot.y);
        }, 200);
        
        // انتظار مدة الحفر
        await new Promise(resolve => setTimeout(resolve, CONFIG.DIG_DURATION));
        
        clearInterval(digInterval);
        character.classList.remove('digging');
        
        // المكافأة
        const reward = Math.floor(
            Math.random() * (CONFIG.DIG_REWARD_MAX - CONFIG.DIG_REWARD_MIN) + CONFIG.DIG_REWARD_MIN
        );
        
        this.state.addZaar(reward);
        this.state.player.totalDigs++;
        spot.dug = true;
        
        spotEl.classList.remove('active');
        spotEl.style.opacity = '0.3';
        
        // جزيئات المكافأة
        createParticles(spot.x, spot.y, '⚛️', 10);
        
        showReward({
            icon: '⛏️',
            title: 'حفر ناجح!',
            zaar: reward,
            last: '0',
        });
        
        this.isDigging = false;
        this.state.save();
    }
}

// ============================================
// 🌓 نظام الوقت
// ============================================
class TimeSystem {
    constructor(gameState, renderer) {
        this.state = gameState;
        this.renderer = renderer;
        this.elapsed = 0;
    }
    
    update(deltaTime) {
        this.elapsed += deltaTime;
        
        // تحديث دورة النهار/الليل
        this.state.world.timeProgress = (this.elapsed % CONFIG.DAY_NIGHT_CYCLE) / CONFIG.DAY_NIGHT_CYCLE;
        
        // تبديل النهار/الليل
        const wasDay = this.state.world.isDay;
        this.state.world.isDay = this.state.world.timeProgress < 0.5;
        
        if (wasDay !== this.state.world.isDay) {
            this.renderer.updateDayNightCycle();
            
            if (this.state.world.isDay) {
                showOwlMessage('🌅 طلع النهار! وقت الصيد');
            } else {
                showOwlMessage('🌙 حل الليل! احذر في الظلام');
            }
        }
    }
    
    toggle() {
        this.state.world.isDay = !this.state.world.isDay;
        this.renderer.updateDayNightCycle();
    }
}

// ============================================
// 🎮 المحرك الرئيسي
// ============================================
class Game {
    constructor() {
        this.state = new GameState();
        this.renderer = new Renderer(this.state);
        this.input = new InputController(this.state, this.renderer);
        this.preyAI = new PreyAI(this.state, this.renderer);
        this.digging = new DiggingSystem(this.state, this.renderer);
        this.time = new TimeSystem(this.state, this.renderer);
        
        this.lastUpdate = Date.now();
        
        this.init();
    }
    
    async init() {
        // إخفاء شاشة التحميل
        setTimeout(() => {
            document.getElementById('loading').classList.add('hide');
            this.showWelcome();
        }, 2000);
        
        // بدء حلقة اللعبة
        this.startGameLoop();
        
        // بدء توليد الفرائس
        setInterval(() => {
            this.preyAI.spawn();
        }, CONFIG.PREY_SPAWN_INTERVAL);
        
        // توليد فرائس أولية
        for (let i = 0; i < 3; i++) {
            this.preyAI.spawn();
        }
    }
    
    startGameLoop() {
        const loop = () => {
            const now = Date.now();
            const deltaTime = now - this.lastUpdate;
            this.lastUpdate = now;
            
            // تحديث الأنظمة
            this.preyAI.update();
            this.time.update(deltaTime);
            this.renderer.updateCamera();
            this.renderer.updateHUD();
            
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);
    }
    
    showWelcome() {
        showOwlMessage(`
            🦉 مرحباً أيها الشبل!
            
            • المس الشبل وحرّكه باصبعك لاستكشاف الغابة
            • اضغط على الحيوانات لصيدها
            • استخدم زر الحفر لجمع الزار من الأرض
            • الليل والنهار يتبدلان تلقائياً
            
            حظاً موفقاً في مغامرتك! 🌲
        `);
    }
}

// ============================================
// 🎨 وظائف مساعدة
// ============================================

function showOwlMessage(message) {
    const owlMsg = document.getElementById('owlMessage');
    owlMsg.innerHTML = message.replace(/\n/g, '<br>');
    owlMsg.classList.add('show');
    
    setTimeout(() => {
        owlMsg.classList.remove('show');
    }, 5000);
}

function showReward(data) {
    const notification = document.getElementById('rewardNotification');
    document.getElementById('rewardIcon').textContent = data.icon;
    document.getElementById('rewardTitle').textContent = data.title;
    document.getElementById('rewardAmount').innerHTML = `+${data.zaar} ⚛️ زار<br>+${data.last} 💎 LAST`;
    
    notification.classList.add('show');
}

function closeReward() {
    document.getElementById('rewardNotification').classList.remove('show');
}

function createParticles(x, y, icon, count) {
    const world = document.getElementById('gameWorld');
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.textContent = icon;
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        
        world.appendChild(particle);
        
        setTimeout(() => particle.remove(), 2000);
    }
}

function createDirtParticles(x, y) {
    const world = document.getElementById('gameWorld');
    
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'dirt-particle';
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 30;
        const xOffset = Math.cos(angle) * distance;
        const yOffset = Math.sin(angle) * distance;
        
        particle.style.setProperty('--x', xOffset + 'px');
        particle.style.setProperty('--y', yOffset + 'px');
        
        world.appendChild(particle);
        
        setTimeout(() => particle.remove(), 1000);
    }
}

// ============================================
// 🎮 الأزرار والتحكم
// ============================================

function toggleDigMode() {
    game.digging.toggleMode();
}

function toggleDayNight() {
    game.time.toggle();
}

// البومة
document.getElementById('owl').onclick = () => {
    const owlMsg = document.getElementById('owlMessage');
    owlMsg.classList.toggle('show');
};

// ============================================
// 🚀 بدء اللعبة
// ============================================
const game = new Game();

console.log('🦁 اللعبة جاهزة!');
