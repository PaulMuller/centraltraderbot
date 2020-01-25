module.exports.okex_arrayParser = array => {
    let result = []
    array.forEach(element => {
        result.push({price: +element[0], amount: +element[1]})
    })
    return result
}
module.exports.binance_objectParser = object => {
    let result = []
    for (let key in object){
        result.push({price: +key, amount: +object[key]})
    }
    return result
}

module.exports.divideByMillion = value => {
    if (!value) return 0
    return +(value/1e6).toFixed(6)
}

module.exports.multiplyByMillion = value => {
    if (!value) return 0
    return +(value * 1e6).toFixed(0)
}

module.exports.arrayRemove = (arr, value) => {
    return arr.filter(ele => {
        return ele != value
    })
}

module.exports.sortByKey = (array, key, reverse = false) => {
    return array.sort((a, b) => {
        var x = a[key]
        var y = b[key]
        let res = ((x < y) ? -1 : ((x > y) ? 1 : 0))
        return reverse? res * -1 : res
    })
}

module.exports.arraysEqual = (a, b, ignoredProperties = []) => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (a.length != b.length) return false
  
    for (let i = 0; i < a.length; ++i) {
      if (!module.exports.objectEqual(a[i] ,b[i], ignoredProperties)) return false
    }
    return true
}

module.exports.objectEqual = (a, b, ignoredProperties = []) => {
    var aProps = Object.getOwnPropertyNames(a)
    var bProps = Object.getOwnPropertyNames(b)

    if (aProps.length != bProps.length) return false 

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i]
        if (ignoredProperties.indexOf(propName)> -1) continue
        if (a[propName] !== b[propName]) return false
    }
    return true
}

module.exports.timeout = ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
}