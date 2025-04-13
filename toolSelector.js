// toolSelector.js
const { setPlayerData, getPlayerData } = require('./playerDataManager');
const { loadConfig, saveConfig } = require('./configManager');
const { logDebug, logInfo } = require('./logger');
// 导入新的选点可视化函数
const { showSelectionVisualization } = require('./bsci');

// Store processing flags and last event time to prevent multiple triggers
const isProcessing = {};
const lastEventTime = {};
const COOLDOWN_PERIOD = 300; // ms - Increased cooldown slightly

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
        const processingKey = player.uuid + '_attack';
        const now = Date.now();
        const lastTime = lastEventTime[processingKey] || 0;

        if (isProcessing[processingKey]) {
            // Flag is set, check time since last processed event
            if (now - lastTime > COOLDOWN_PERIOD) {
                // Enough time passed, likely a new distinct click. Reset and process.
                logDebug(`Attack event for ${player.name} - Cooldown passed (${now - lastTime}ms). Processing new click.`);
                // Proceed to update timestamp and run logic below
            } else {
                // Within cooldown, likely a duplicate from the same click. Ignore.
                logDebug(`Attack event for ${player.name} ignored due to processing flag/cooldown (${now - lastTime}ms).`);
                return false; // Cancel the event
            }
        } else {
             // Flag not set, this is the first event in a potential sequence
             logDebug(`Attack event for ${player.name} - First event in sequence.`);
             isProcessing[processingKey] = true; // Set the flag
        }

        // Set/update last event time and process the action
        lastEventTime[processingKey] = now;
        logDebug(`Attack event processing timestamp updated for ${player.name}.`);
        
        // --- Core logic ---
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
        // 检查两个点是否存在且在同一维度，然后调用新的选点可视化函数
        if (playerData && playerData.pos1 && playerData.pos2 && playerData.pos1.dimid === playerData.pos2.dimid) {
            showSelectionVisualization(player, playerData.pos1, playerData.pos2);
        }
        player.tell(`§a已使用工具设置点1: x:${Math.floor(pos.x)} y:${Math.floor(pos.y)} z:${Math.floor(pos.z)} 维度:${player.pos.dimid}`);
        return false; // Cancel the original attack event
    }
}

// 
function onUseItemOn(player, item, block, side, pos) {
    const toolConfig = getToolConfig();
    
    // If feature disabled or no tool configured, exit early
    if (!toolConfig.enabled || !toolConfig.tool) {
        return;
    }
    
    // Check if player is holding the configured tool
    if (item && item.type === toolConfig.tool) {
        const processingKey = player.uuid + '_use';
        const now = Date.now();
        const lastTime = lastEventTime[processingKey] || 0;

        if (isProcessing[processingKey]) {
             // Flag is set, check time since last processed event
            if (now - lastTime > COOLDOWN_PERIOD) {
                // Enough time passed, likely a new distinct click. Reset and process.
                 logDebug(`Use event for ${player.name} - Cooldown passed (${now - lastTime}ms). Processing new click.`);
                 // Proceed to update timestamp and run logic below
            } else {
                // Within cooldown, likely a duplicate from the same click. Ignore.
                logDebug(`Use event for ${player.name} ignored due to processing flag/cooldown (${now - lastTime}ms).`);
                return false; // Cancel the event
            }
        } else {
            // Flag not set, this is the first event in a potential sequence
            logDebug(`Use event for ${player.name} - First event in sequence.`);
            isProcessing[processingKey] = true; // Set the flag
        }
        
        // Set/update last event time and process the action
        lastEventTime[processingKey] = now;
        logDebug(`Use event processing timestamp updated for ${player.name}.`);

        // --- Core logic ---
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
        // 检查两个点是否存在且在同一维度，然后调用新的选点可视化函数
        if (playerData && playerData.pos1 && playerData.pos2 && playerData.pos1.dimid === playerData.pos2.dimid) {
            showSelectionVisualization(player, playerData.pos1, playerData.pos2);
        }
        
        player.tell(`§a已使用工具设置点2: x:${Math.floor(blockPos.x)} y:${Math.floor(blockPos.y)} z:${Math.floor(blockPos.z)} 维度:${player.pos.dimid}`);
        return false; // Cancel the original use event
    }
}

// Clean up flags and timestamps when player leaves
function onPlayerLeft(player) {
    const attackKey = player.uuid + '_attack';
    const useKey = player.uuid + '_use';
    delete isProcessing[attackKey];
    delete lastEventTime[attackKey];
    delete isProcessing[useKey];
    delete lastEventTime[useKey];
    logDebug(`Processing flags and timestamps cleared for leaving player ${player.name}.`);
}


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
