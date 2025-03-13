// 文件路径常量
const AREA_DATA_PATH = './plugins/area/areas.json';

// 读取区域数据
function loadAreaData() {
    if (File.exists(AREA_DATA_PATH)) {
        let content = File.readFrom(AREA_DATA_PATH);
        try {
            return JSON.parse(content) || {};
        } catch(e) {
            return {};
        }
    }
    return {};
}


// 保存区域数据
function saveAreaData(data) {
    let jsonStr = JSON.stringify(data, null, 2);
    let dir = './plugins/area';
    if (!File.exists(dir)) {
        File.mkdir(dir);
    }
    return File.writeTo(AREA_DATA_PATH, jsonStr);
}

module.exports = {
    loadAreaData,
    saveAreaData
};