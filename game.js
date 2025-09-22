// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.myPlayer = null;
        this.players = {};
        this.avatars = {};
        this.avatarImages = {}; // Cached avatar images
        
        // Viewport
        this.viewportX = 0;
        this.viewportY = 0;
        
        // WebSocket
        this.ws = null;
        
        // Movement
        this.keysPressed = {};
        this.isMoving = false;
        this.movementIntervals = {};
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Make canvas focusable for keyboard events
        this.canvas.tabIndex = 0;
        this.canvas.focus();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.drawWorld();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.drawWorld();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupKeyboardControls() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        // Keep canvas focused for keyboard events
        this.canvas.addEventListener('click', () => {
            this.canvas.focus();
        });
    }
    
    handleKeyDown(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Prevent default behavior (scrolling)
        event.preventDefault();
        
        // Check if this key is already pressed
        if (this.keysPressed[event.code]) {
            return;
        }
        
        // Mark key as pressed
        this.keysPressed[event.code] = true;
        
        // Send move command
        this.sendMoveCommand(event.code);
        
        // Set up continuous movement
        this.startContinuousMovement(event.code);
    }
    
    handleKeyUp(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Prevent default behavior
        event.preventDefault();
        
        // Mark key as released
        delete this.keysPressed[event.code];
        
        // Stop continuous movement for this key
        this.stopContinuousMovement(event.code);
        
        // Check if any movement keys are still pressed
        const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        const anyKeyPressed = movementKeys.some(key => this.keysPressed[key]);
        
        if (!anyKeyPressed) {
            // No keys pressed, send stop command
            this.sendStopCommand();
        }
    }
    
    sendMoveCommand(keyCode) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const directionMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        const direction = directionMap[keyCode];
        if (direction) {
            const message = {
                action: 'move',
                direction: direction
            };
            this.ws.send(JSON.stringify(message));
            console.log('Sent move command:', direction);
        }
    }
    
    sendStopCommand() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            action: 'stop'
        };
        this.ws.send(JSON.stringify(message));
        console.log('Sent stop command');
    }
    
    startContinuousMovement(keyCode) {
        // Clear any existing interval for this key
        if (this.movementIntervals[keyCode]) {
            clearInterval(this.movementIntervals[keyCode]);
        }
        
        // Start sending move commands repeatedly
        this.movementIntervals[keyCode] = setInterval(() => {
            this.sendMoveCommand(keyCode);
        }, 100); // Send command every 100ms
    }
    
    stopContinuousMovement(keyCode) {
        // Clear the interval for this key
        if (this.movementIntervals[keyCode]) {
            clearInterval(this.movementIntervals[keyCode]);
            delete this.movementIntervals[keyCode];
        }
    }
    
    connectToServer() {
        try {
            this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.ws.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from game server');
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Nick N'
        };
        this.ws.send(JSON.stringify(message));
    }
    
    handleServerMessage(message) {
        console.log('Server message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.myPlayer = this.players[this.myPlayerId];
                    this.loadAvatarImages();
                    this.updateViewport();
                    this.drawWorld();
                } else {
                    console.error('Join game failed:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImage(message.avatar);
                this.drawWorld();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                // Update viewport to follow my player
                if (this.myPlayerId && this.players[this.myPlayerId]) {
                    this.myPlayer = this.players[this.myPlayerId];
                    this.updateViewport();
                }
                this.drawWorld();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.drawWorld();
                break;
        }
    }
    
    loadAvatarImages() {
        for (const avatarName in this.avatars) {
            this.loadAvatarImage(this.avatars[avatarName]);
        }
    }
    
    loadAvatarImage(avatar) {
        const avatarImage = new Image();
        avatarImage.onload = () => {
            this.avatarImages[avatar.name] = avatarImage;
            this.drawWorld();
        };
        // Use the first frame of the south direction as default
        avatarImage.src = avatar.frames.south[0];
    }
    
    updateViewport() {
        if (!this.myPlayer) return;
        
        // Center viewport on my player
        this.viewportX = this.myPlayer.x - this.canvas.width / 2;
        this.viewportY = this.myPlayer.y - this.canvas.height / 2;
        
        // Clamp to map boundaries
        this.viewportX = Math.max(0, Math.min(this.viewportX, this.worldWidth - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(this.viewportY, this.worldHeight - this.canvas.height));
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.viewportX,
            y: worldY - this.viewportY
        };
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // source rectangle
            0, 0, this.canvas.width, this.canvas.height  // destination rectangle
        );
        
        // Draw all players
        this.drawPlayers();
    }
    
    drawPlayers() {
        console.log('Drawing players:', Object.keys(this.players).length, 'players');
        for (const playerId in this.players) {
            const player = this.players[playerId];
            this.drawPlayer(player);
        }
    }
    
    drawPlayer(player) {
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Draw avatar if available
        if (this.avatarImages[player.avatar]) {
            const avatarSize = 32;
            this.ctx.drawImage(
                this.avatarImages[player.avatar],
                screenPos.x - avatarSize / 2,
                screenPos.y - avatarSize / 2,
                avatarSize,
                avatarSize
            );
        }
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            player.username,
            screenPos.x,
            screenPos.y - 20
        );
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
