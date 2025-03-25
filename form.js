
const { isInArea, checkNewAreaOverlap ,checkAreaSizeLimits} = require('./utils');
const { calculateAreaPrice, handleAreaPurchase } = require('./economy');
const config = require('./config');
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 显示创建区域的表单
function showCreateAreaForm(pl, point1, point2, areaData, playerData, saveAreaData, updateAreaCallback, checkPlayerCallback) {
    const form = mc.newCustomForm();
    form.setTitle("创建区域");
    const price = calculateAreaPrice(point1, point2);
    form.addLabel(`§e创建费用：${price} 金币`);
    form.addLabel(`区域范围：从(${point1.x}, ${point1.y}, ${point1.z})到(${point2.x}, ${point2.y}, ${point2.z})`);
    form.addLabel(`所在维度：${point1.dimid}`);
    form.addInput("请输入区域名称", "例如：我的家");

    pl.sendForm(form, (player, data) => {
        if (data === null) return;
        
        const areaName = data[3];
        if (!areaName) {
            player.tell("§c区域名称不能为空！");
            return;
        }
        
        // 添加区域数量检查
        const { isAreaAdmin } = require('./areaAdmin');
        const { countPlayerAreas } = require('./utils');
        const { loadConfig } = require('./configManager');
        const config = loadConfig();
        
        // 区域管理员无视限制
        if (!isAreaAdmin(player.uuid) && config.maxAreasPerPlayer !== -1) {
            const ownedAreas = countPlayerAreas(player.xuid, areaData);
            if (ownedAreas >= config.maxAreasPerPlayer) {
                player.tell(`§c你已达到最大区域数量限制 (${config.maxAreasPerPlayer})！请删除一些现有区域后再创建新的。`);
                return;
            }
        }
        const newArea = {
            point1: { ...point1 },
            point2: { ...point2 },
            dimid: point1.dimid
        };
        const sizeCheck = checkAreaSizeLimits(point1, point2, config, false);
    
        if (!sizeCheck.valid) {
            pl.tell(`§c无法创建区域: ${sizeCheck.message}`);
            return;
        }
        const overlapCheck = checkNewAreaOverlap(newArea, areaData);
        if(overlapCheck.overlapped) {
            player.tell(`§c无法创建区域：与现有区域 "${overlapCheck.overlappingArea.name}" 重叠！`);
            return;
        }
        if (!handleAreaPurchase(player, point1, point2, () => {
            const areaId = generateAreaId();
            
            // 确保areaData存在
            if (!areaData) {
                areaData = {};
            }
            
            areaData[areaId] = {
                name: areaName,
                point1: { 
                    x: point1.x,
                    y: point1.y,
                    z: point1.z
                },
                point2: { 
                    x: point2.x,
                    y: point2.y,
                    z: point2.z
                },
                dimid: point1.dimid,
                xuid: player.xuid,
                uuid: player.uuid,
                createTime: new Date().getTime(),
                price: price 
            };
            
            // 保存数据
            if(saveAreaData(areaData)) {
                pl.tell("§a区域创建成功！");
                // 立即更新区域数据并显示
                updateAreaCallback(areaData);
                checkPlayerCallback(pl);
                
                // 清除玩家的临时点位数据
                delete playerData[pl.uuid].pos1;
                delete playerData[pl.uuid].pos2;
                
                player.tell(
                    `§a成功创建区域：${areaName}\n` +
                    `§aID：${areaId}\n` +
                    `§a区域范围：从(${point1.x}, ${point1.y}, ${point1.z})到(${point2.x}, ${point2.y}, ${point2.z})\n` +
                    `§a所在维度：${point1.dimid}`
                );
            } else {
                pl.tell("§c区域创建失败，请检查日志！");
            }
        })) {
            // 交易失败的情况已在handleAreaPurchase中处理
            return;
        }
        
        // 清理临时数据
        if(playerData[player.uuid]) {
            delete playerData[player.uuid];
        }
    });
}

function generateAreaId() {
    return 'area_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

module.exports = {
    showCreateAreaForm
};