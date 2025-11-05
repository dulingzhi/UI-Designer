// 色通知单位碰撞
native DzSetUnitCollisionSize takes unit whichUnit, real value returns nothing

// 设置单位名字
native DzSetUnitName takes unit whichUnit, string value returns nothing

// 设置英雄称谓
native DzSetUnitProperName takes unit whichUnit, string value returns nothing

// 设置单位头像模型
native DzSetUnitPortrait takes unit whichUnit, string value returns nothing

// 设置单位描述
native DzSetUnitDescription takes unit whichUnit, string value returns nothing

// 设置单位普攻弹道模型
native DzSetUnitMissileModel takes unit whichUnit, string value returns nothing

// 设置单位普攻弹道弧度
native DzSetUnitMissileArc takes unit whichUnit, real value returns nothing

// 设置单位普攻弹道速度
native DzSetUnitMissileSpeed takes unit whichUnit, real value returns nothing

// 设置单位普攻弹道自导允许
native DzSetUnitMissileHoming takes unit whichUnit, boolean enable returns nothing

// 设置单位指向UI是否显示
native DzSetUnitPreselectUIVisible takes unit whichUnit, boolean visible returns nothing
