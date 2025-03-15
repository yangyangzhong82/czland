// areaAdmin.js
const { getDbSession } = require('./database');
const getOfflinePlayerData = ll.import("PlayerData", "getOfflinePlayerData");
// 存储领地管理员列表
let areaAdmins = {};

// 初始化时加载领地管理员数据
function loadAreaAdmins() {
    try {
        const db = getDbSession();
        
        // 检查表是否存在
        db.exec(`
            CREATE TABLE IF NOT EXISTS area_admins (
                uuid TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                addTime INTEGER NOT NULL
            );
        `);
        
        // 查询所有管理员
        const results = db.query("SELECT * FROM area_admins");
        
        if (!results || results.length <= 1) {
            logger.info("没有找到领地管理员数据");
            return {};
        }
        
        // 转换为对象格式
        const admins = {};
        for (let i = 1; i < results.length; i++) {
            const row = results[i];
            admins[row[0]] = {
                name: row[1],
                addTime: row[2]
            };
        }
        
        logger.info(`成功加载${Object.keys(admins).length}个领地管理员`);
        areaAdmins = admins;
        return admins;
    } catch (e) {
        logger.error(`加载领地管理员数据失败: ${e}`);
        return {};
    }
}

// 保存领地管理员数据
function saveAreaAdmins() {
    try {
        const db = getDbSession();
        
        // 开始事务
        db.exec("BEGIN TRANSACTION");
        
        // 清空旧数据
        db.exec("DELETE FROM area_admins");
        
        // 插入新数据
        const stmt = db.prepare("INSERT INTO area_admins (uuid, name, addTime) VALUES (?, ?, ?)");
        
        for (const uuid in areaAdmins) {
            const admin = areaAdmins[uuid];
            stmt.bind([uuid, admin.name, admin.addTime]);
            stmt.execute();
            stmt.reset();
        }
        
        // 提交事务
        db.exec("COMMIT");
        
        logger.info(`成功保存${Object.keys(areaAdmins).length}个领地管理员数据`);
        return true;
    } catch (e) {
        // 回滚事务
        try {
            getDbSession().exec("ROLLBACK");
        } catch (rollbackErr) {
            logger.error(`事务回滚失败: ${rollbackErr}`);
        }
        
        logger.error(`保存领地管理员数据失败: ${e}`);
        return false;
    }
}

// 添加领地管理员
function addAreaAdmin(uuid, name) {
    if (areaAdmins[uuid]) {
        return false; // 已经是管理员
    }
    
    areaAdmins[uuid] = {
        name: name,
        addTime: Date.now()
    };
    
    return true;
}


function findPlayerByName(playerName) {
    // 先尝试查找在线玩家
    const onlinePlayer = mc.getPlayer(playerName);
    if (onlinePlayer) {
        return {
            uuid: onlinePlayer.uuid,
            name: onlinePlayer.name,
            isOnline: true
        };
    }
    
    // 如果找不到在线玩家，尝试查找离线玩家
    const offlinePlayers = getOfflinePlayerData();
    const matchedPlayer = offlinePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    
    if (matchedPlayer) {
        return {
            uuid: matchedPlayer.uuid,
            name: matchedPlayer.name,
            isOnline: false
        };
    }
    
    return null;
}

// 移除领地管理员
function removeAreaAdmin(uuid) {
    if (!areaAdmins[uuid]) {
        return false; // 不是管理员
    }
    
    delete areaAdmins[uuid];
    return true;
}

// 检查玩家是否是领地管理员
function isAreaAdmin(uuid) {
    return !!areaAdmins[uuid];
}

// 获取所有领地管理员
function getAllAreaAdmins() {
    return {...areaAdmins};
}

// 初始化加载
loadAreaAdmins();

module.exports = {
    addAreaAdmin,
    removeAreaAdmin,
    isAreaAdmin,
    getAllAreaAdmins,
    saveAreaAdmins,
    loadAreaAdmins,
    findPlayerByName
};