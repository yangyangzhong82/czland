// permissionData.js

const PERMISSION_DATA_PATH = './plugins/area/permissions.json';

// 加载权限组数据
function loadPermissionData() {
    if (File.exists(PERMISSION_DATA_PATH)) {
        let content = File.readFrom(PERMISSION_DATA_PATH);
        try {
            return JSON.parse(content) || {};
        } catch(e) {
            return {};
        }
    }
    return {};
}

// 保存权限组数据
function savePermissionData(data) {
    let jsonStr = JSON.stringify(data, null, 2);
    let dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    return File.writeTo(PERMISSION_DATA_PATH, jsonStr);
}

module.exports = {
    loadPermissionData,
    savePermissionData
};