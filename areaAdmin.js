// areaAdmin.js
const { getDbSession } = require('./database');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
const { logDebug, logInfo, logWarning, logError } = require('./logger');
// 存储领地管理员列表 (内存缓存)
let areaAdmins = {};
// 缓存 findPlayerByName 的结果
const findPlayerByNameCache = {};
const FIND_PLAYER_CACHE_TTL = 60 * 1000; // 缓存有效期 (1分钟)

// 初始化时从数据库加载领地管理员数据到内存缓存
function loadAreaAdmins() {
    try {
        const db = getDbSession(); // 获取数据库会话

        // 查询所有管理员 (仅选择需要的列以提高效率)
        const results = db.query("SELECT uuid, name, addTime FROM area_admins");

        if (!results) {
             logWarning("查询领地管理员表返回 null 或 undefined"); // 使用 logWarning
             areaAdmins = {}; // 确保出错时缓存为空
             return {};
        }
        // 如果结果只有一行或没有行 (只有表头或完全为空)
        if (results.length <= 1) {
            logInfo("数据库中没有找到领地管理员数据"); // 使用 logInfo
            areaAdmins = {}; // 确保缓存为空
            return {};
        }

        // 将查询结果转换为以 UUID 为键的对象格式
        const admins = {};
        const headers = results[0].map(h => h.toLowerCase()); // 获取表头并转为小写
        const uuidIndex = headers.indexOf('uuid');
        const nameIndex = headers.indexOf('name');
        const addTimeIndex = headers.indexOf('addtime');

        // 检查表头是否包含必要的列
        if (uuidIndex === -1 || nameIndex === -1 || addTimeIndex === -1) {
            logError("领地管理员表结构不匹配，缺少 uuid, name 或 addTime 列"); // 使用 logError
            areaAdmins = {}; // 清空缓存
            return {};
        }

        // 遍历数据行 (从索引 1 开始，跳过表头)
        for (let i = 1; i < results.length; i++) {
            const row = results[i];
            // 确保行数据有效且长度与表头匹配
            if (row && row.length === headers.length) {
                 admins[row[uuidIndex]] = { // 使用 UUID 作为键
                     name: row[nameIndex],
                     addTime: row[addTimeIndex]
                 };
            } else {
                 logWarning(`跳过格式不正确的领地管理员行 ${i}`); // 使用 logWarning
            }
        }

        logInfo(`成功从数据库加载 ${Object.keys(admins).length} 个领地管理员`); // 使用 logInfo
        areaAdmins = admins; // 更新内存缓存
        return admins; // 返回加载的数据 (虽然通常直接用缓存)
    } catch (e) {
        logError(`加载领地管理员数据失败: ${e.message}`, e.stack); // 使用 logError, 记录 e.message
        areaAdmins = {}; // 确保出错时缓存为空
        return {};
    }
}
// 将内存中的领地管理员数据保存回数据库
function saveAreaAdmins() {
    let db;
    try {
        db = getDbSession(); // 获取数据库会话

        // 开始数据库事务，确保操作的原子性
        db.exec("BEGIN TRANSACTION"); // <- 优化：使用事务

        // 清空表中的旧数据，准备写入新数据
        db.exec("DELETE FROM area_admins");

        // 准备 SQL 插入语句 (预编译语句提高性能和安全性)
        const stmt = db.prepare("INSERT INTO area_admins (uuid, name, addTime) VALUES (?, ?, ?)");

        // 检查预编译语句是否成功创建
        if (!stmt) {
            logError("数据库预编译语句创建失败 (prepare returned null/undefined)");
            db.exec("ROLLBACK"); // 回滚事务
            return false;
        }

        let savedCount = 0;
        // 遍历内存缓存中的管理员数据
        for (const uuid in areaAdmins) {
            const admin = areaAdmins[uuid];
            // 进行基本的数据验证
            if (admin && typeof uuid === 'string' && typeof admin.name === 'string' && typeof admin.addTime === 'number') {
                // 在绑定前记录详细信息
                logDebug(`准备绑定管理员数据: UUID=${uuid} (Type: ${typeof uuid}), Name=${admin.name} (Type: ${typeof admin.name}), AddTime=${admin.addTime} (Type: ${typeof admin.addTime})`);
                try {
                    stmt.bind([uuid, admin.name, admin.addTime]); // 绑定参数
                    stmt.execute(); // 执行插入
                    stmt.clear(); // 清除已绑定的参数，为下次循环准备
                    savedCount++;
                } catch (bindOrExecError) {
                    logError(`绑定或执行管理员数据时出错 for UUID ${uuid}: ${bindOrExecError.message}`, bindOrExecError.stack);
                    // 遇到错误时，可以选择继续尝试保存其他管理员或立即回滚
                    // 这里选择记录错误并继续，但最后会回滚整个事务
                    stmt.clear(); // 确保清除已绑定的参数
                    // 抛出错误以便外层 catch 捕获并回滚
                    throw new Error(`保存管理员 ${uuid} 失败: ${bindOrExecError.message}`);
                }
            } else {
                logWarning(`跳过无效的管理员数据 for UUID: ${uuid}. Data: ${JSON.stringify(admin)}`); // 使用 logWarning
                // 无需重置，因为没有执行 bind/execute
            }
        }

        // 提交事务，将所有更改写入数据库
        db.exec("COMMIT"); // <- 优化：提交事务

        logInfo(`成功保存 ${savedCount} / ${Object.keys(areaAdmins).length} 个领地管理员数据到数据库`); // 使用 logInfo
        return true; // 保存成功
    } catch (e) {
        logError(`保存领地管理员数据失败: ${e.message}`, e.stack); // 使用 logError, 记录 e.message
        // 如果发生错误，回滚事务，撤销本次操作的所有更改
        if (db && db.isOpen()) { // 检查数据库连接是否仍然有效
            try {
                db.exec("ROLLBACK"); // <- 优化：出错时回滚
                logInfo("管理员保存事务已回滚"); // 使用 logInfo
            } catch (rollbackErr) {
                logError(`事务回滚失败: ${rollbackErr.message}`); // 使用 logError
            }
        } else {
             logError("数据库连接无效，无法回滚事务"); // 使用 logError
        }
        return false; // 保存失败
    } finally {
        // 可以在这里 finalize/reset 预编译语句，但 LLSE 环境下可能由引擎自动处理
        // if (stmt) stmt.finalize(); // 如果需要手动释放资源
    }
}

// 添加一个新的领地管理员到内存缓存
function addAreaAdmin(uuid, name) {
    // 基本参数验证
    if (typeof uuid !== 'string' || uuid === '' || typeof name !== 'string' || name === '') {
         logWarning(`尝试添加无效的管理员: UUID='${uuid}', Name='${name}'`); // 使用 logWarning
         return false;
    }
    // 检查是否已经是管理员
    if (areaAdmins[uuid]) {
        logDebug(`玩家 ${name} (${uuid}) 已经是管理员，无需重复添加`); // 使用 logDebug
        return false; // 已经是管理员
    }

    // 添加到内存缓存
    areaAdmins[uuid] = {
        name: name,
        addTime: Date.now() // 记录添加时间
    };
    logInfo(`领地管理员 ${name} (${uuid}) 已添加到缓存`); // 使用 logInfo
    // 考虑是否需要立即保存到数据库，或者标记缓存为“脏”，稍后统一保存
    // saveAreaAdmins(); // 如果需要立即持久化，取消此行注释
    return true; // 添加成功
}

// 根据玩家名称查找玩家信息 (UUID 和 准确名称) - 优化：增加缓存
function findPlayerByName(playerName) {
    const lowerCaseName = playerName.toLowerCase(); // 使用小写名称作为缓存键
    const now = Date.now();

    // 检查缓存
    if (findPlayerByNameCache[lowerCaseName] && (now - findPlayerByNameCache[lowerCaseName].timestamp < FIND_PLAYER_CACHE_TTL)) {
        logDebug(`[Cache Hit] findPlayerByName for "${playerName}"`);
        return findPlayerByNameCache[lowerCaseName].data; // 返回缓存数据
    }

    logDebug(`[Cache Miss] findPlayerByName for "${playerName}"`);

    // 1. 尝试查找在线玩家
    const onlinePlayer = mc.getPlayer(playerName); // 使用 LLSE API 查找在线玩家
    if (onlinePlayer) {
        const result = {
            uuid: onlinePlayer.uuid,
            name: onlinePlayer.name, // 使用在线玩家的准确名称
            isOnline: true
        };
        // 更新缓存
        findPlayerByNameCache[lowerCaseName] = { data: result, timestamp: now };
        return result;
    }

    // 2. 如果找不到在线玩家，尝试查找离线玩家数据
    try {
        // 调用导入的 PlayerData API 获取离线玩家数据
        const offlinePlayersData = getOfflinePlayerData();
        if (!offlinePlayersData || typeof offlinePlayersData !== 'object') {
             logWarning("getOfflinePlayerData 返回无效数据或非对象类型"); // 使用 logWarning
             // 缓存查找失败的结果 (null)
             findPlayerByNameCache[lowerCaseName] = { data: null, timestamp: now };
             return null;
        }
        // 假设 offlinePlayersData 是一个对象数组，结构类似 [{uuid, name, ...}]
        if (Array.isArray(offlinePlayersData)) {
             // 查找名称匹配的玩家 (已转小写)
             const matchedPlayer = offlinePlayersData.find(p => p && typeof p.name === 'string' && p.name.toLowerCase() === lowerCaseName);

             // 如果找到匹配且 UUID 有效
             if (matchedPlayer && typeof matchedPlayer.uuid === 'string') {
                 const result = {
                     uuid: matchedPlayer.uuid,
                     name: matchedPlayer.name, // 使用离线数据中的准确名称
                     isOnline: false
                 };
                 // 更新缓存
                 findPlayerByNameCache[lowerCaseName] = { data: result, timestamp: now };
                 return result;
             }
        } else {
             logWarning("getOfflinePlayerData 返回的不是预期的数组格式"); // 使用 logWarning
        }

    } catch(e) {
         logError(`查找离线玩家数据时出错: ${e.message}`, e.stack); // 使用 logError
         // 出错时也缓存 null，避免短时间内重复尝试失败的查找
         findPlayerByNameCache[lowerCaseName] = { data: null, timestamp: now };
         return null;
    }

    // 3. 如果在线和离线都找不到
    logDebug(`未找到名为 "${playerName}" 的在线或离线玩家`); // 使用 logDebug
    // 缓存查找失败的结果 (null)
    findPlayerByNameCache[lowerCaseName] = { data: null, timestamp: now };
    return null; // 未找到玩家
}

// 根据 UUID 从内存缓存中移除领地管理员
function removeAreaAdmin(uuid) {
    // 基本参数验证
    if (typeof uuid !== 'string' || uuid === '') {
         logWarning(`尝试移除无效的管理员 UUID: '${uuid}'`); // 使用 logWarning
         return false;
    }
   // 检查该 UUID 是否确实是管理员
   if (!areaAdmins[uuid]) {
       logDebug(`UUID ${uuid} 不是管理员，无需移除`); // 使用 logDebug
       return false; // 不是管理员
   }

   const adminName = areaAdmins[uuid].name; // 在删除前获取名称用于日志记录
   delete areaAdmins[uuid]; // 从缓存中删除
   logInfo(`领地管理员 ${adminName} (${uuid}) 已从缓存移除`); // 使用 logInfo
   // 考虑是否需要立即保存到数据库
   // saveAreaAdmins(); // 如果需要立即持久化，取消此行注释
   return true; // 移除成功
}

// 检查指定 UUID 的玩家是否是领地管理员
function isAreaAdmin(uuid) {
    // 直接检查缓存中是否存在该 UUID 的键
    return !!areaAdmins[uuid]; // 使用 !! 将值转换为布尔类型
}

// 获取所有领地管理员的列表 (返回缓存的浅拷贝以防止外部修改)
function getAllAreaAdmins() {
    return {...areaAdmins}; // 使用扩展运算符创建浅拷贝
}

// 插件加载时自动执行一次加载操作
loadAreaAdmins();

module.exports = {
    addAreaAdmin, // 导出添加管理员函数
    removeAreaAdmin, // 导出移除管理员函数
    isAreaAdmin, // 导出检查是否为管理员函数
    getAllAreaAdmins, // 导出获取所有管理员列表函数
    saveAreaAdmins, // 导出保存管理员数据函数 (可能用于手动保存或特定场景)
    loadAreaAdmins, // 导出加载管理员数据函数 (可能用于手动重载)
    findPlayerByName // 导出根据名称查找玩家函数
};
