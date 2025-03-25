// toolSelector.js
const { setPlayerData, getPlayerData } = require('./playerDataManager');
const { loadConfig, saveConfig } = require('./configManager');
const { logDebug, logInfo } = require('./logger');
const { showAreaVisualization } = require('./bsci');

// Store last interaction time to prevent multiple triggers
const lastInteractionTime = {};

// Get tool configuration from config
function getToolConfig() {
    const config = loadConfig();
    // Add tool selector config if not present
    if (!config.toolSelector) {
        config.toolSelector = {
            enabled: false,
            tool: "minecraft:stick"  // Default tool is a stick, null would disable
        };
        saveConfig(config);
    }
    return config.toolSelector;
}

// Handler for setting pos1 when attacking a block (left click)
function onAttackBlock(player, block, item) {
    const toolConfig = getToolConfig();
    
    // If feature disabled or no tool configured, exit early
    if (!toolConfig.enabled || !toolConfig.tool) {
        return;
    }
    
    // Check if player is holding the configured tool
    if (item && item.type === toolConfig.tool) {
        const pos = block.pos;
        
        setPlayerData(player.uuid, {
            pos1: {
                x: Math.floor(pos.x),
                y: Math.floor(pos.y),
                z: Math.floor(pos.z),
                dimid: player.pos.dimid,
            }
        });
        const playerData = getPlayerData()[player.uuid];
        if (playerData && playerData.pos2 && playerData.pos1.dimid === playerData.pos2.dimid) {
            showAreaVisualization(player, playerData.pos1, playerData.pos2);
        }
        player.tell(`§a已使用工具设置点1: x:${pos.x} y:${pos.y} z:${pos.z} 维度:${player.pos.dimid}`);
        return false; // Cancel the original attack event
    }
}

// Handler for setting pos2 when using a tool on a block (right click)
function onUseItemOn(player, item, block, side, pos) {
    const toolConfig = getToolConfig();
    
    // If feature disabled or no tool configured, exit early
    if (!toolConfig.enabled || !toolConfig.tool) {
        return;
    }
    
    // Check if player is holding the configured tool
    if (item && item.type === toolConfig.tool) {
        const now = Date.now();
        const lastTime = lastInteractionTime[player.uuid] || 0;
        
        // Implement cooldown to prevent multiple triggers
        if (now - lastTime < 500) { // 500ms cooldown
            return false; // Cancel the event but don't set position again
        }
        
        lastInteractionTime[player.uuid] = now;
        
        const blockPos = block.pos;
        
        setPlayerData(player.uuid, {
            pos2: {
                x: Math.floor(blockPos.x),
                y: Math.floor(blockPos.y),
                z: Math.floor(blockPos.z),
                dimid: player.pos.dimid,
            }
        });
        const playerData = getPlayerData()[player.uuid];
        if (playerData && playerData.pos1 && playerData.pos1.dimid === playerData.pos2.dimid) {
            showAreaVisualization(player, playerData.pos1, playerData.pos2);
        }
        
        player.tell(`§a已使用工具设置点2: x:${blockPos.x} y:${blockPos.y} z:${blockPos.z} 维度:${player.pos.dimid}`);
        return false; // Cancel the original use event
    }
}

// Clean up timers when player leaves
function onPlayerLeft(player) {
    delete lastInteractionTime[player.uuid];
}

// Initialize the module
function init() {
    const toolConfig = getToolConfig();
    if (toolConfig.enabled && toolConfig.tool) {
        logInfo(`工具选择器已启用，使用工具: ${toolConfig.tool}`);
        mc.listen("onAttackBlock", onAttackBlock);
        mc.listen("onUseItemOn", onUseItemOn);
        mc.listen("onLeft", onPlayerLeft);
    } else {
        logInfo("工具选择器未启用");
    }
}
module.exports = {
    init,
    getToolConfig
};