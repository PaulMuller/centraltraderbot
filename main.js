const EventEmitter = require(`events`)
const moment = require(`moment`)
const pairs = require(`./pairs`)
const exchanges = require(`./exchanges`)
const {okex_arrayParser, binance_objectParser, arrayRemove, arraysEqual} = require(`./helpers`)
const { WsApi, HttpApi } = require(`okex-api`)
const Binance = require("node-binance-api")
const httpApi = new HttpApi()
const wsApi = new WsApi()

let arbitrageSituations = {}
let responces = {}


const main = () => {
    const emitter = new EventEmitter()
    Object.keys(pairs.observablePairs).forEach(pair => {
        responces[pair] = {}
        arbitrageSituations[pair] = []

        pairs.observablePairs[pair].exchanges.forEach( async exchangeId => {
            subscribeTo(emitter, exchangeId, pair)
            emitter.on(exchangeId+pair, responce => {
                responces[pair][exchangeId] = responce
                let tmp = recalculateSituations(responces[pair], pairs.observableExchanges.array, exchangeId, pair)
                if (!arraysEqual(tmp, arbitrageSituations[pair], [`caller`])){
                    
                    
                    
                    arbitrageSituations[pair] = tmp
                    let totalArbitrageSituations = getTotalArbitrageSituations(arbitrageSituations)
                    console.log(totalArbitrageSituations.length > 0 ? console.time(`1`) : console.timeEnd(`1`))
                    console.log(`======================= ${moment(Date.now()).format(`HH:mm:ss`)} ===========================`)
                    console.log(totalArbitrageSituations.length > 0 ? totalArbitrageSituations : `no arbitrage`)
                }
            })
        })
    })
}

const subscribeTo = async (emitter, exchangeId, pair) => {
    switch (exchangeId) {
        case `okex`:
            const channels = (await httpApi.futures.getInstruments()).filter(t => t.startsWith(`${pairs.observablePairs[pair].firstToken}-${pairs.observablePairs[pair].secondToken}-`))

            wsApi.futures.depth.addListener(data => {
                data = data[0]

                let receivedPair = data.instrument_id.split(`-`)[0]+data.instrument_id.split(`-`)[1]
                let eventName = exchangeId + receivedPair
                let responce = {
                    asks : okex_arrayParser(data.asks),
                    bids : okex_arrayParser(data.bids),
                }

                emitter.emit(eventName,responce)
            })

            for (const ins of channels) await wsApi.futures.depth.subscribe(ins)
            console.log(`---subscribed to ${exchangeId} ${pair}`)

            break
        case `huobi`:
            break
        case `binance`:
            const binance = new Binance()
            let eventName = exchangeId + pair
            binance_ws = binance.websockets.depthCache([pair], (pair, depth) => {
                let responce = {
                    asks : binance_objectParser(binance.sortAsks(depth.asks, 5)),
                    bids : binance_objectParser(binance.sortBids(depth.bids, 5)),
                }
                emitter.emit(eventName, responce)
            })
            console.log(`---subscribed to ${exchangeId} ${pair}`)
            break
        default:
            break;
    }
    
}

const recalculateSituations = (responces, exchangesArray, caller, pair) => {
    let arbitrageSituations = []
    exchangesArray.forEach( selectedExchange => {
        if (!responces[selectedExchange]) return
        const mainAsk = responces[selectedExchange].asks[0].price
        const mainAmount = responces[selectedExchange].asks[0].amount

        const otherExchanges = arrayRemove(exchangesArray, selectedExchange)
        otherExchanges.forEach( selectedOtherEchange => {
            if (!responces[selectedOtherEchange]) return
            const subBid = responces[selectedOtherEchange].bids[0].price
            
            const subAmount = responces[selectedOtherEchange].bids[0].amount
            const minAmount = Math.min(mainAmount,subAmount)
            const result = subBid / mainAsk - (exchanges[selectedExchange].fee||0) - (exchanges[selectedOtherEchange].fee||0)
            const profit = parseInt(((minAmount) * (result -1)).toFixed(2))

            if (profit > 0) {
                let pa = 0
                let pb = 0
                let vaSumm = mainAmount
                let vbSumm = subAmount

                const bids = responces[selectedOtherEchange].bids
                const asks = responces[selectedExchange].asks

                let checkNextStep = true
                while (checkNextStep){
                    if(!bids[pb+2] || !asks[pa+2]) checkNextStep = false
                    
                    if (vaSumm > vbSumm){
                        if (bids[pb+1].price/asks[pa+1].price - (exchanges[selectedExchange].fee||0) - (exchanges[selectedOtherEchange].fee||0) >1){
                            pb++
                            vbSumm+= bids[pb].amount
                        }else{
                            checkNextStep = false
                        }
                    }else{
                        if (bids[pb+1].price/asks[pa+1].price - (exchanges[selectedExchange].fee||0) - (exchanges[selectedOtherEchange].fee||0) >1){
                            pa++
                            vaSumm+= asks[pa].amount
                        }else{
                            checkNextStep = false
                        }
                    }
                }

                arbitrageSituations.push({
                    pair: pair,
                    firstExchange: selectedExchange,
                    secondExchange: selectedOtherEchange,
                    firstAsk: +asks[pa].price.toFixed(6),
                    secondBid: +bids[pb].price.toFixed(6),
                    result: +(bids[pb].price / asks[pa].price).toFixed(6),
                    minAmount: +Math.min(vbSumm,vaSumm).toFixed(6),
                    caller: caller,
                    profit: +((Math.min(vbSumm,vaSumm)) * (bids[pb].price / asks[pa].price - 1) * (Math.max(bids[pb].price, asks[pa].price))).toFixed(2),
                })
            }
        })
    })

    return arbitrageSituations
}

const getTotalArbitrageSituations = arbitrageSituations => {
    let totalArbitrageSituations = []
    Object.keys(arbitrageSituations).forEach(key => {
        arbitrageSituations[key].forEach(situation => {
            totalArbitrageSituations.push(situation)
        })
    })

    return totalArbitrageSituations
}




main()

