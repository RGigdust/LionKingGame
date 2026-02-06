// ============================================
// ⚙️ إعدادات اللعبة
// ============================================
const CONFIG = {
    // مراحل التطور
    STAGES: {
        CUB: { name: 'شبل صغير', icon: '🐾', zaarRequired: 0, huntMultiplier: 1 },
        TEEN: { name: 'شبل مراهق', icon: '🦁', zaarRequired: 100, huntMultiplier: 1.5 },
        YOUNG: { name: 'أسد شاب', icon: '🦁', zaarRequired: 500, huntMultiplier: 2 },
        KING: { name: 'ملك الغابة', icon: '👑🦁', zaarRequired: 1000, huntMultiplier: 3 }
    },
    
    // الفرائس
    PREY_TYPES: {
        HAMSTER: { icon: '🐹', zaarReward: 5, lastReward: 0.001, minStage: 'CUB', speed: 3 },
        RABBIT: { icon: '🐰', zaarReward: 10, lastReward: 0.002, minStage: 'CUB', speed: 4 },
        DEER: { icon: '🦌', zaarReward: 25, lastReward: 0.005, minStage: 'YOUNG', speed: 5 },
        BOAR: { icon: '🐗', zaarReward: 50, lastReward: 0.01, minStage: 'KING', speed: 6 }
    },
    
    // نظام الطاقة
    ENERGY_MAX: 100,
    ENERGY_REGEN_PER_SECOND: 0.5,
    HUNT_ENERGY_COST: 10,
    
    // الصياد (المركزية)
    HUNTER_SPAWN_CHANCE: 0.3,
    HUNTER_DURATION: 10000, // 10 ثوان
    
    // معدل ظهور الفرائس
    PREY_SPAWN_INTERVAL: 3000, // 3 ثوان
    MAX_PREY_ON_SCREEN: 5,
    
    // تحويل زار إلى LAST
    ZAAR_TO_LAST_RATIO: 100, // كل 100 زار = 1 LAST
};

// ============================================
// 🎮 حالة اللعبة
// ============================================
class GameState {
    constructor() {
        this.player = {
            stage: 'CUB',
            zaar: 0,
            last: 0,
            energy: CONFIG.ENERGY_MAX,
            totalHunts: 0,
            currentScene: 'forest',
            inLake: false,
            canDodge: false, // يستطيع المراوغة عند الشاب والملك
        };
        
        this.activePrey = [];
        this.hunterActive = false;
        this.hunterTimeout = null;
        
        this.posts = [];
        this.dailyTasks = [];
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        
        this.autoConvert = true; // تحويل تلقائي للزار إلى LAST
        
        this.loadFromStorage();
    }
    
    // حفظ البيانات
    save() {
        localStorage.setItem('lastGame', JSON.stringify({
            player: this.player,
            posts: this.posts,
        }));
    }
    
    // تحميل البيانات
    loadFromStorage() {
        const saved = localStorage.getItem('lastGame');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.player = { ...this.player, ...data.player };
                this.posts = data.posts || [];
            } catch (e) {
                console.error('Failed to load game data:', e);
            }
        }
        this.generateDailyTasks();
    }
    
    // تحديث الطاقة
    updateEnergy(delta) {
        if (this.player.energy < CONFIG.ENERGY_MAX) {
            this.player.energy = Math.min(
                CONFIG.ENERGY_MAX,
                this.player.energy + CONFIG.ENERGY_REGEN_PER_SECOND * (delta / 1000)
            );
        }
    }
    
    // إضافة زار
    addZaar(amount) {
        this.player.zaar += amount;
        
        // تحويل تلقائي إلى LAST
        if (this.autoConvert && this.player.zaar >= CONFIG.ZAAR_TO_LAST_RATIO) {
            const lastToAdd = Math.floor(this.player.zaar / CONFIG.ZAAR_TO_LAST_RATIO);
            this.player.last += lastToAdd;
            this.player.zaar -= lastToAdd * CONFIG.ZAAR_TO_LAST_RATIO;
            
            showNotification(`🎉 تحويل تلقائي: +${lastToAdd} LAST`);
        }
        
        this.save();
    }
    
    // التحقق من إمكانية التطور
    canEvolve() {
        const stages = Object.keys(CONFIG.STAGES);
        const currentIndex = stages.indexOf(this.player.stage);
        
        if (currentIndex >= stages.length - 1) return false; // أقصى مرحلة
        
        const nextStage = stages[currentIndex + 1];
        const required = CONFIG.STAGES[nextStage].zaarRequired;
        
        return this.player.zaar >= required;
    }
    
    // التطور
    evolve() {
        if (!this.canEvolve()) return false;
        
        const stages = Object.keys(CONFIG.STAGES);
        const currentIndex = stages.indexOf(this.player.stage);
        const nextStage = stages[currentIndex + 1];
        
        this.player.stage = nextStage;
        
        // تفعيل المراوغة للمراحل المتقدمة
        if (nextStage === 'YOUNG' || nextStage === 'KING') {
            this.player.canDodge = true;
        }
        
        this.save();
        return true;
    }
    
    // توليد مهام يومية
    generateDailyTasks() {
        this.dailyTasks = [
            { id: 1, title: 'اصطد 5 فرائس', progress: 0, target: 5, reward: 20, completed: false },
            { id: 2, title: 'اجمع 50 زار', progress: 0, target: 50, reward: 10, completed: false },
            { id: 3, title: 'انشر في البحيرة', progress: 0, target: 1, reward: 15, completed: false },
        ];
    }
    
    // تحديث المهمة
    updateTask(taskId, progress) {
        const task = this.dailyTasks.find(t => t.id === taskId);
        if (task && !task.completed) {
            task.progress = Math.min(task.progress + progress, task.target);
            
            if (task.progress >= task.target) {
                task.completed = true;
                this.addZaar(task.reward);
                showNotification(`✅ أكملت المهمة: ${task.title}\n🎁 +${task.reward} زار`);
            }
        }
    }
}

// ============================================
// 🎯 نظام الصيد
// ============================================
class HuntingSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.preyContainer = document.getElementById('preyContainer');
    }
    
    // توليد فريسة
    spawnPrey() {
        // التحقق من العدد الأقصى
        if (this.gameState.activePrey.length >= CONFIG.MAX_PREY_ON_SCREEN) {
            return;
        }
        
        // اختيار نوع الفريسة المناسب للمرحلة
        const availablePrey = Object.entries(CONFIG.PREY_TYPES).filter(([key, prey]) => {
            const stageIndex = Object.keys(CONFIG.STAGES).indexOf(this.gameState.player.stage);
            const minStageIndex = Object.keys(CONFIG.STAGES).indexOf(prey.minStage);
            return stageIndex >= minStageIndex;
        });
        
        if (availablePrey.length === 0) return;
        
        const [preyKey, preyData] = availablePrey[Math.floor(Math.random() * availablePrey.length)];
        
        const prey = document.createElement('div');
        prey.className = 'prey';
        prey.innerHTML = preyData.icon;
        prey.dataset.type = preyKey;
        
        // موضع عشوائي
        const x = Math.random() * (window.innerWidth - 100);
        const y = 100 + Math.random() * (window.innerHeight - 300);
        prey.style.left = x + 'px';
        prey.style.top = y + 'px';
        
        // حدث النقر للصيد
        prey.onclick = () => this.catchPrey(prey, preyKey, preyData);
        
        this.preyContainer.appendChild(prey);
        this.gameState.activePrey.push({ element: prey, type: preyKey });
        
        // إزالة تلقائية بعد 10 ثوان
        setTimeout(() => {
            if (prey.parentElement) {
                prey.remove();
                this.gameState.activePrey = this.gameState.activePrey.filter(p => p.element !== prey);
            }
        }, 10000);
    }
    
    // صيد الفريسة
    catchPrey(element, preyKey, preyData) {
        // التحقق من الطاقة
        if (this.gameState.player.energy < CONFIG.HUNT_ENERGY_COST) {
            showNotification('⚠️ طاقتك غير كافية!');
            return;
        }
        
        // استهلاك الطاقة
        this.gameState.player.energy -= CONFIG.HUNT_ENERGY_COST;
        
        // تأثير الصيد
        element.classList.add('caught');
        const character = document.getElementById('character');
        character.classList.add('hunting');
        
        setTimeout(() => {
            character.classList.remove('hunting');
        }, 500);
        
        // حساب المكافأة
        const stage = CONFIG.STAGES[this.gameState.player.stage];
        const zaarReward = Math.floor(preyData.zaarReward * stage.huntMultiplier);
        const lastReward = preyData.lastReward * stage.huntMultiplier;
        
        this.gameState.addZaar(zaarReward);
        this.gameState.player.last += lastReward;
        this.gameState.player.totalHunts++;
        
        // تحديث المهام
        this.gameState.updateTask(1, 1); // مهمة الصيد
        this.gameState.updateTask(2, zaarReward); // مهمة جمع الزار
        
        // إزالة الفريسة
        element.remove();
        this.gameState.activePrey = this.gameState.activePrey.filter(p => p.element !== element);
        
        // جزيئات المكافأة
        createParticles(element.offsetLeft, element.offsetTop, '⚛️', 5);
        
        // نافذة المكافأة
        showReward({
            icon: preyData.icon,
            title: 'صيد رائع!',
            zaar: zaarReward,
            last: lastReward.toFixed(3),
        });
        
        this.gameState.save();
        updateUI();
    }
    
    // مسح جميع الفرائس
    clearAllPrey() {
        this.gameState.activePrey.forEach(prey => {
            if (prey.element.parentElement) {
                prey.element.remove();
            }
        });
        this.gameState.activePrey = [];
    }
}

// ============================================
// 👮 نظام الصياد (المركزية)
// ============================================
class HunterSystem {
    constructor(gameState, huntingSystem) {
        this.gameState = gameState;
        this.huntingSystem = huntingSystem;
        this.hunter = document.getElementById('hunter');
        this.owlGuide = document.getElementById('owlGuide');
    }
    
    // تفعيل الصياد
    activate() {
        if (this.gameState.hunterActive || this.gameState.player.inLake) return;
        
        this.gameState.hunterActive = true;
        this.hunter.classList.add('active');
        
        // رسالة البومة
        showOwlMessage('⚠️ الصياد قادم! اذهب للبحيرة لحماية عملاتك!');
        
        // تأثير الخوف على الشبل
        const character = document.getElementById('character');
        character.classList.add('scared');
        
        // إزالة الصياد بعد 10 ثوان
        this.gameState.hunterTimeout = setTimeout(() => {
            this.deactivate();
        }, CONFIG.HUNTER_DURATION);
    }
    
    // إلغاء تفعيل الصياد
    deactivate() {
        this.gameState.hunterActive = false;
        this.hunter.classList.remove('active');
        
        const character = document.getElementById('character');
        character.classList.remove('scared');
        
        if (this.gameState.hunterTimeout) {
            clearTimeout(this.gameState.hunterTimeout);
            this.gameState.hunterTimeout = null;
        }
        
        showOwlMessage('✅ الصياد رحل! يمكنك الاستكشاف بأمان.');
    }
    
    // مراوغة الصياد (للمراحل المتقدمة)
    dodge() {
        if (!this.gameState.player.canDodge || !this.gameState.hunterActive) {
            return false;
        }
        
        // نجحت المراوغة
        this.deactivate();
        showNotification('🎭 راوغت الصياد ببراعة!');
        this.gameState.addZaar(30); // مكافأة المراوغة
        
        return true;
    }
}

// ============================================
// 🌊 نظام البحيرة الاجتماعية
// ============================================
class SocialSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.feedContainer = document.getElementById('socialFeed');
    }
    
    // إنشاء منشور
    createPost(content) {
        const post = {
            id: Date.now(),
            username: 'اللاعب',
            stage: this.gameState.player.stage,
            content: content,
            likes: 0,
            timestamp: Date.now(),
        };
        
        this.gameState.posts.unshift(post);
        this.gameState.save();
        
        // مكافأة النشر
        this.gameState.addZaar(10);
        this.gameState.updateTask(3, 1); // مهمة النشر
        
        this.renderFeed();
        showNotification('✅ تم نشر مغامرتك!\n🎁 +10 زار');
    }
    
    // عرض المنشورات
    renderFeed() {
        this.feedContainer.innerHTML = '';
        
        if (this.gameState.posts.length === 0) {
            this.feedContainer.innerHTML = `
                <div style="text-align: center; padding: 50px; color: rgba(255,255,255,0.5);">
                    <p style="font-size: 3em; margin-bottom: 20px;">🌊</p>
                    <p>البحيرة فارغة!</p>
                    <p>كن أول من يشارك مغامرته</p>
                </div>
            `;
            return;
        }
        
        this.gameState.posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post';
            
            const stageIcon = CONFIG.STAGES[post.stage].icon;
            const timeAgo = this.getTimeAgo(post.timestamp);
            
            postEl.innerHTML = `
                <div class="post-header">
                    <span class="icon">${stageIcon}</span>
                    <span class="username">${post.username}</span>
                    <span style="font-size: 0.8em; opacity: 0.6;">${timeAgo}</span>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <button onclick="likePost(${post.id})">❤️ ${post.likes}</button>
                    <button>💬 تعليق</button>
                    <button>🔄 مشاركة</button>
                </div>
            `;
            
            this.feedContainer.appendChild(postEl);
        });
    }
    
    // الإعجاب بمنشور
    likePost(postId) {
        const post = this.gameState.posts.find(p => p.id === postId);
        if (post) {
            post.likes++;
            this.gameState.save();
            this.renderFeed();
        }
    }
    
    // حساب الوقت المنقضي
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'الآن';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} د`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} س`;
        return `${Math.floor(seconds / 86400)} ي`;
    }
}

// ============================================
// 🎨 نظام السويب
// ============================================
class SwipeSystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.sceneContainer = document.getElementById('sceneContainer');
        this.currentScene = 'forest';
        
        this.setupSwipeListeners();
    }
    
    setupSwipeListeners() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });
        
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
        });
    }
    
    handleSwipe(startX, startY, endX, endY) {
        const diffX = endX - startX;
        const diffY = endY - startY;
        
        // تجاهل السويب العمودي
        if (Math.abs(diffY) > Math.abs(diffX)) return;
        
        // الحد الأدنى للسويب
        if (Math.abs(diffX) < 50) return;
        
        if (diffX > 0) {
            // سويب يمين
            this.swipeRight();
        } else {
            // سويب يسار
            this.swipeLeft();
        }
    }
    
    swipeLeft() {
        if (this.currentScene === 'forest') {
            this.goToScene('lake');
            
            // الذهاب للبحيرة يحمي من الصياد
            if (this.gameState.hunterActive) {
                this.gameState.player.inLake = true;
                showOwlMessage('✅ أنت بأمان في البحيرة!');
            }
        } else if (this.currentScene === 'academy') {
            this.goToScene('forest');
        }
    }
    
    swipeRight() {
        if (this.currentScene === 'forest') {
            this.goToScene('academy');
        } else if (this.currentScene === 'lake') {
            this.goToScene('forest');
            this.gameState.player.inLake = false;
        }
    }
    
    goToScene(sceneName) {
        this.currentScene = sceneName;
        this.sceneContainer.className = `scene-container show-${sceneName}`;
        this.gameState.player.currentScene = sceneName;
        this.gameState.save();
        
        // تحديث البحيرة إذا دخلها
        if (sceneName === 'lake') {
            game.socialSystem.renderFeed();
        }
        
        // تحديث المهام إذا دخل الأكاديمية
        if (sceneName === 'academy') {
            renderDailyTasks();
        }
    }
}

// ============================================
// 🎬 واجهة المستخدم
// ============================================
function updateUI() {
    // تحديث العملات
    document.getElementById('zaarCount').textContent = Math.floor(game.state.player.zaar);
    document.getElementById('lastCount').textContent = game.state.player.last.toFixed(3);
    
    // تحديث الطاقة
    const energyPercent = (game.state.player.energy / CONFIG.ENERGY_MAX) * 100;
    const energyFill = document.getElementById('energyFill');
    energyFill.style.width = energyPercent + '%';
    energyFill.textContent = Math.floor(game.state.player.energy) + '%';
    
    // تحديث الشخصية
    const stage = CONFIG.STAGES[game.state.player.stage];
    document.getElementById('character').innerHTML = stage.icon;
    document.getElementById('stageIndicator').innerHTML = `${stage.icon} ${stage.name}`;
    
    // زر التطور
    const evolveBtn = document.getElementById('evolveBtn');
    const evolutionIndicator = document.getElementById('evolutionIndicator');
    
    if (game.state.canEvolve()) {
        evolveBtn.style.display = 'block';
        evolutionIndicator.style.display = 'block';
    } else {
        evolveBtn.style.display = 'none';
        evolutionIndicator.style.display = 'none';
    }
}

// عرض المكافأة
function showReward(data) {
    const popup = document.getElementById('rewardPopup');
    document.getElementById('rewardIcon').textContent = data.icon;
    document.getElementById('rewardTitle').textContent = data.title;
    document.getElementById('rewardAmount').innerHTML = `
        +${data.zaar} ⚛️ زار<br>
        +${data.last} 💎 LAST
    `;
    document.getElementById('rewardMessage').textContent = data.message || '';
    
    popup.classList.add('active');
}

function closeRewardPopup() {
    document.getElementById('rewardPopup').classList.remove('active');
}

// إشعار سريع
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 15px 25px;
        border-radius: 10px;
        border: 2px solid #ffd700;
        z-index: 1000;
        animation: fadeIn 0.3s;
        max-width: 90%;
        text-align: center;
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// رسالة البومة
function showOwlMessage(message) {
    const owlSpeech = document.getElementById('owlSpeech');
    const owlMessage = document.getElementById('owlMessage');
    
    owlMessage.textContent = message;
    owlSpeech.classList.add('active');
    
    setTimeout(() => {
        owlSpeech.classList.remove('active');
    }, 5000);
}

function toggleOwlSpeech() {
    const owlSpeech = document.getElementById('owlSpeech');
    owlSpeech.classList.toggle('active');
}

// جزيئات التأثيرات
function createParticles(x, y, icon, count) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.textContent = icon;
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.fontSize = (1 + Math.random()) + 'em';
        
        document.body.appendChild(particle);
        
        setTimeout(() => particle.remove(), 2000);
    }
}

// التطور
function evolve() {
    if (!game.state.evolve()) return;
    
    const evolutionScreen = document.getElementById('evolutionScreen');
    const gate = document.getElementById('evolutionGate');
    const newChar = document.getElementById('newCharacter');
    const title = document.getElementById('evolutionTitle');
    
    const stage = CONFIG.STAGES[game.state.player.stage];
    
    evolutionScreen.classList.add('active');
    
    // أنيميشن تحطم البوابة
    setTimeout(() => {
        gate.classList.add('breaking');
    }, 500);
    
    // ظهور الشخصية الجديدة
    setTimeout(() => {
        newChar.textContent = stage.icon;
        newChar.classList.add('show');
        title.textContent = `تطورت إلى: ${stage.name}! 🎉`;
    }, 2500);
    
    updateUI();
}

function closeEvolutionScreen() {
    document.getElementById('evolutionScreen').classList.remove('active');
    document.getElementById('evolutionGate').classList.remove('breaking');
    document.getElementById('newCharacter').classList.remove('show');
}

// إنشاء منشور
function createPost() {
    const content = prompt('شارك مغامرتك:');
    if (content && content.trim()) {
        game.socialSystem.createPost(content.trim());
    }
}

// الإعجاب بمنشور
function likePost(postId) {
    game.socialSystem.likePost(postId);
}

// عرض المهام اليومية
function renderDailyTasks() {
    const container = document.getElementById('dailyTasks');
    container.innerHTML = '<h2 style="margin-bottom: 30px;">📋 المهام اليومية</h2>';
    
    game.state.dailyTasks.forEach(task => {
        const progress = (task.progress / task.target) * 100;
        const taskEl = document.createElement('div');
        taskEl.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 15px;
            border: 2px solid ${task.completed ? '#4caf50' : 'rgba(255, 255, 255, 0.2)'};
        `;
        
        taskEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-weight: bold;">${task.completed ? '✅' : '⭕'} ${task.title}</span>
                <span style="color: #ffd700;">+${task.reward} زار</span>
            </div>
            <div style="background: rgba(0,0,0,0.3); height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="background: #4caf50; height: 100%; width: ${progress}%;"></div>
            </div>
            <div style="text-align: center; margin-top: 5px; font-size: 0.9em; opacity: 0.8;">
                ${task.progress} / ${task.target}
            </div>
        `;
        
        container.appendChild(taskEl);
    });
}

// الإعدادات
function openSettings() {
    const settings = `
        🎮 إعدادات اللعبة
        
        المرحلة: ${CONFIG.STAGES[game.state.player.stage].name}
        إجمالي الصيد: ${game.state.player.totalHunts}
        
        خيارات:
        - تحويل تلقائي للزار: ${game.state.autoConvert ? 'مفعّل ✅' : 'معطّل ❌'}
        - المراوغة: ${game.state.player.canDodge ? 'متاحة ✅' : 'غير متاحة ❌'}
    `;
    
    alert(settings);
}

// ============================================
// 🎮 تهيئة اللعبة
// ============================================
class Game {
    constructor() {
        this.state = new GameState();
        this.huntingSystem = new HuntingSystem(this.state);
        this.hunterSystem = new HunterSystem(this.state, this.huntingSystem);
        this.socialSystem = new SocialSystem(this.state);
        this.swipeSystem = new SwipeSystem(this.state);
        
        this.lastUpdate = Date.now();
        
        this.init();
    }
    
    init() {
        updateUI();
        this.startGameLoop();
        this.startPreySpawner();
        this.startHunterSpawner();
        
        // رسالة ترحيب
        setTimeout(() => {
            showOwlMessage(`
                مرحباً أيها الشبل! 🐾
                
                اصطد الفرائس لتجمع الزار والـ LAST!
                اسحب يساراً للبحيرة، ويميناً للأكاديمية.
                
                احذر من الصياد! 🎯
            `);
        }, 1000);
    }
    
    startGameLoop() {
        setInterval(() => {
            const now = Date.now();
            const delta = now - this.lastUpdate;
            this.lastUpdate = now;
            
            // تحديث الطاقة
            this.state.updateEnergy(delta);
            updateUI();
        }, 100);
    }
    
    startPreySpawner() {
        setInterval(() => {
            if (this.state.player.currentScene === 'forest' && !this.state.hunterActive) {
                this.huntingSystem.spawnPrey();
            }
        }, CONFIG.PREY_SPAWN_INTERVAL);
    }
    
    startHunterSpawner() {
        setInterval(() => {
            if (this.state.player.currentScene === 'forest' && 
                !this.state.hunterActive && 
                Math.random() < CONFIG.HUNTER_SPAWN_CHANCE) {
                this.hunterSystem.activate();
            }
        }, 20000); // كل 20 ثانية فرصة لظهور الصياد
    }
}

// بدء اللعبة
const game = new Game();

// مفاتيح سريعة للاختبار
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') game.swipeSystem.swipeLeft();
    if (e.key === 'ArrowRight') game.swipeSystem.swipeRight();
    if (e.key === 'd' && game.state.hunterActive && game.state.player.canDodge) {
        game.hunterSystem.dodge();
    }
});
