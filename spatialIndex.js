// spatialIndex.js
const { logDebug, logWarning, logError } = require('./logger'); // 引入日志记录器
const { loadConfig } = require('./configManager'); 

const config = loadConfig();
const CHUNK_SIZE = config.spatialIndex?.chunkSize || 16; 

// 将世界坐标转换为区块坐标
function worldToChunkCoords(x, z) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    return { chunkX, chunkZ };
}

/**
 * 构建空间索引
 * @param {object} areaData - { areaId: areaObject, ... }
 * @returns {object} spatialIndex - { dimId: { chunkX: { chunkZ: [areaId1, ...] } } }
 */
function buildSpatialIndex(areaData) {
    //logDebug("开始构建空间索引...");
    const spatialIndex = {}; // { dimId: { chunkX: { chunkZ: [areaId1, ...] } } }

    for (const areaId in areaData) {
        const area = areaData[areaId];
        if (!area || !area.point1 || !area.point2 || area.dimid === undefined || area.dimid === null) { // 增加维度检查
            logWarning(`构建索引时跳过无效或缺少维度的区域数据: ${areaId}`);
            continue;
        }

        const dimId = area.dimid;

        // 计算区域覆盖的最小和最大区块坐标
        const minX = Math.min(area.point1.x, area.point2.x);
        const maxX = Math.max(area.point1.x, area.point2.x);
        const minZ = Math.min(area.point1.z, area.point2.z);
        const maxZ = Math.max(area.point1.z, area.point2.z);

        const startChunk = worldToChunkCoords(minX, minZ);
        const endChunk = worldToChunkCoords(maxX, maxZ);

        if (!spatialIndex[dimId]) {
            spatialIndex[dimId] = {};
        }
        const dimIndex = spatialIndex[dimId];

        // 遍历区域覆盖的所有区块
        for (let cx = startChunk.chunkX; cx <= endChunk.chunkX; cx++) {
            if (!dimIndex[cx]) {
                dimIndex[cx] = {};
            }
            const chunkXIndex = dimIndex[cx];

            for (let cz = startChunk.chunkZ; cz <= endChunk.chunkZ; cz++) {
                if (!chunkXIndex[cz]) {
                    chunkXIndex[cz] = [];
                }
                // 将区域 ID 添加到该区块的列表中
                if (!chunkXIndex[cz].includes(areaId)) { // 避免重复添加
                    chunkXIndex[cz].push(areaId);
                }
            }
        }
    }
    //logDebug("空间索引构建完成。");
    //logDebug("索引内容:", JSON.stringify(spatialIndex, null, 2)); // 可选：打印索引内容进行调试
    return spatialIndex;
}

/**
 * 从空间索引查询候选区域ID
 * @param {object} pos - 玩家位置 {x, y, z, dimid}
 * @param {object} spatialIndex - 构建好的空间索引
 * @returns {string[]} 候选区域ID列表
 */
function querySpatialIndex(pos, spatialIndex) {
    if (pos.dimid === undefined || pos.dimid === null) {
        logWarning(`查询索引时玩家位置缺少维度信息: ${JSON.stringify(pos)}`);
        return [];
    }
    const { chunkX, chunkZ } = worldToChunkCoords(pos.x, pos.z);
    const dimId = pos.dimid;

    try {
        const candidates = spatialIndex?.[dimId]?.[chunkX]?.[chunkZ];
        //logDebug(`查询索引: dim=${dimId}, cx=${chunkX}, cz=${chunkZ}, 候选区域数=${candidates ? candidates.length : 0}`);
        return candidates || []; // 返回空数组，而不是undefined
    } catch (e) {
        logError(`查询空间索引时出错: dim=${dimId}, cx=${chunkX}, cz=${chunkZ}`, e);
        return [];
    }
}

module.exports = {
    buildSpatialIndex,
    querySpatialIndex,
    worldToChunkCoords // 导出 worldToChunkCoords 函数
};
