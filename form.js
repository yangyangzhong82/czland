
const { isInArea, checkNewAreaOverlap ,checkAreaSizeLimits, calculateAreaVolume, calculatePlayerTotalAreaSize } = require('./utils'); // 引入 calculateAreaVolume, calculatePlayerTotalAreaSize
const { calculateAreaPrice, handleAreaPurchase } = require('./economy');
const { loadConfig } = require('./configManager'); // 引入 loadConfig
const {logDebug, logInfo, logWarning, logError } = require('./logger');
// 显示创建区域的表单
// 显示创建区域的表单
function showCreateAreaForm(pl, point1, point2, areaData, playerData, saveAreaData, updateAreaCallback, checkPlayerCallback) {
    const form = mc.newCustomForm();
    form.setTitle("创建区域");

    const config = loadConfig(); // 加载配置
    const economyConfig = config.economy;

    // 计算区域尺寸
    const length = Math.abs(point2.x - point1.x) + 1;
    const width = Math.abs(point2.z - point1.z) + 1;
    const height = Math.abs(point2.y - point1.y) + 1;
    const volume = length * width * height;

    // 获取维度名称
    const getDimensionName = (dimid) => {
        switch(dimid) {
            case 0: return 'overworld';
            case 1: return 'nether';
            case 2: return 'end';
            default: return 'overworld';
        }
    };
    const dimensionName = getDimensionName(point1.dimid);
    const dimMultiplier = economyConfig.priceByDimension[dimensionName] || 1;

    // 构造详细信息
    form.addLabel(`§f区域大小: ${length}(长) x ${width}(宽) x ${height}(高) = ${volume}(体积)`);
    form.addLabel(`§f所在维度: ${dimensionName} (价格倍率: x${dimMultiplier})`);

    // 显示当前总大小和限制 ---
    const currentTotalSize = calculatePlayerTotalAreaSize(pl.xuid, areaData);
    let sizeLimitText = "";
    if (config.maxTotalAreaSizePerPlayer > 0) {
        sizeLimitText = ` / ${config.maxTotalAreaSizePerPlayer}`;
    } else {
        sizeLimitText = " (无限制)";
    }
    form.addLabel(`§f当前拥有总大小: ${currentTotalSize}${sizeLimitText}`);
    // --- 结束 ---

    if (economyConfig.enabled) {
        const price = calculateAreaPrice(point1, point2);
        let priceDetails = "";
        if (economyConfig.priceFormula.useCustom) {
            priceDetails = `§f计算公式: ${economyConfig.priceFormula.formula}`;
        } else {
            if (economyConfig.priceByVolume) {
                priceDetails = `§f计算方式: 体积(${volume}) * 每方块价格(${economyConfig.pricePerBlock})`;
            } else {
                priceDetails = `§f计算方式: (长+宽+高)(${length + width + height}) * 每方块价格(${economyConfig.pricePerBlock})`;
            }
        }
        // 如果维度倍率不是1，则显示
        if (dimMultiplier !== 1) {
             priceDetails += ` * 维度倍率(${dimMultiplier})`;
        }

        form.addLabel(priceDetails);
        form.addLabel(`§e最终创建费用: ${price} ${economyConfig.type === 'scoreboard' ? '点' : '金币'}`);
        form.addLabel(`§7(最低 ${economyConfig.minPrice}, 最高 ${economyConfig.maxPrice})`);
    } else {
        form.addLabel("§a经济系统未启用，免费创建");
    }
    // --- 新增代码 结束 ---

    // form.addLabel(`§e创建费用：${price} 金币`); // 旧代码，将被上面的详细信息替代
    form.addLabel(`§7区域范围：从(${point1.x}, ${point1.y}, ${point1.z})到(${point2.x}, ${point2.y}, ${point2.z})`);
    // form.addLabel(`所在维度：${point1.dimid}`); // 旧代码，已被上面的详细信息替代
    form.addInput("请输入区域名称", "例如：我的家");

    pl.sendForm(form, (player, data) => {
        if (data === null) return;

        // --- 修改表单数据索引 ---
        // 由于前面增加了多个 Label，输入框的索引会改变
        // 需要找到 addInput 在所有 addXXX 调用中的位置
        // --- 修改表单数据索引 ---
        // 根据前面添加的 Label 数量动态计算 Input 的索引
        // 基础 Label 数量: 大小(1) + 维度(1) + 当前总大小(1) + 范围(1) = 4
        // 经济系统启用时额外增加: 计算方式(1) + 最终费用(1) + 价格范围(1) = 3
        // 经济系统禁用时额外增加: 免费提示(1) = 1
        // Input 在 Label 之后
        let labelCount = 3; // 起始就有 大小, 维度, 当前总大小 三个 Label
        if (economyConfig.enabled) {
            labelCount += 3; // 计算方式, 最终费用, 价格范围
        } else {
            labelCount += 1; // 免费创建
        }
        labelCount += 1; // 区域范围 Label
        const inputIndex = labelCount; // Input 是紧接着这些 Label 的第一个可交互元素
        const areaName = data[inputIndex];
        // --- 修改结束 ---
        if (!areaName) {
            player.tell("§c区域名称不能为空！");
            return;
        }
        
        // 添加区域数量检查
        const { isAreaAdmin } = require('./areaAdmin');
        const { countPlayerAreas } = require('./utils');


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

        // 检查总区域大小限制 ---
        if (!isAreaAdmin(player.uuid) && config.maxTotalAreaSizePerPlayer > 0) {
            const currentTotalSize = calculatePlayerTotalAreaSize(player.xuid, areaData);
            const newAreaVolume = calculateAreaVolume({ point1, point2 }); // 计算新区域体积
            if (currentTotalSize + newAreaVolume > config.maxTotalAreaSizePerPlayer) {
                player.tell(`§c无法创建区域：创建后总区域大小将达到 ${currentTotalSize + newAreaVolume}，超过了你的总大小限制 ${config.maxTotalAreaSizePerPlayer}！`);
                return;
            }
        }
        // --- 检查结束 ---


        // --- 修改 handleAreaPurchase 调用 ---
        // 不再需要在回调中计算 price，因为上面已经计算过了
        const finalPrice = economyConfig.enabled ? calculateAreaPrice(point1, point2) : 0;
        if (!handleAreaPurchase(player, point1, point2, () => { // handleAreaPurchase 内部会重新计算价格并扣费
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
                price: finalPrice // 使用上面计算好的最终价格
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
                    `§a所在维度：${dimensionName}` // 使用计算好的维度名称
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
            // 保留 playerData[player.uuid] 但清除点位
             if (playerData[player.uuid].pos1) delete playerData[player.uuid].pos1;
             if (playerData[player.uuid].pos2) delete playerData[player.uuid].pos2;
             // 如果对象变空，可以考虑删除整个条目，但这取决于 playerData 的其他用途
             // if (Object.keys(playerData[player.uuid]).length === 0) {
             //     delete playerData[player.uuid];
             // }
        }
    });
}

function generateAreaId() {
    return 'area_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

module.exports = {
    showCreateAreaForm
};
