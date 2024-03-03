class PriorityQueue {
    constructor(comparator = (a, b) => a > b) {
        this._heap = [];
        this._comparator = comparator;
    }
    size() { return this._heap.length; }
    isEmpty() { return this.size() == 0; }
    peek() { return this._heap[0]; }
    push(...values) {
        values.forEach(value => {
            this._heap.push(value);
            this._siftUp();
        });
        return this.size();
    }
    pop() {
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > 0) this._swap(0, bottom);

        this._heap.pop();
        this._siftDown();
        return poppedValue;
    }
    _parent(i) { return ((i + 1) >>> 1) - 1 }
    _left(i) { return (i << 1) + 1 }
    _right(i) { return (i + 1) << 1 }
    replace(value) {
        const replacedValue = this.peek();
        this._heap[0] = value;
        this._siftDown();
        return replacedValue;
    }
    _greater(i, j) { return this._comparator(this._heap[i], this._heap[j]); }
    _swap(i, j) { [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]]; }
    _siftUp() {
        let node = this.size() - 1;
        while (node > 0 && this._greater(node, this._parent(node))) {
            this._swap(node, this._parent(node));
            node = this._parent(node);
        }
    }
    _siftDown() {
        let node = 0;
        while (
            (this._left(node) < this.size() && this._greater(this._left(node), node)) ||
            (this._right(node) < this.size() && this._greater(this._right(node), node))
        ) {
            let maxChild = (this._right(node) < this.size() && this._greater(this._right(node), this._left(node))) ? this._right(node) : this._left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
}

var getJSONAsync = function (url, callback, error) {
    var request = new XMLHttpRequest()
    request.onreadystatechange = function () {
        if (this.readyState == 4) {
            if (this.status == 200) {
                callback(JSON.parse(this.responseText))
            } else {
                error(request.statusText)
            }
        }
    }
    request.open("GET", url, true)
    request.send()
}

var testLocalStorage = function () {
    var test = "test"
    try {
        localStorage.setItem(test, test)
        localStorage.removeItem(test)
        return true
    } catch (e) {
        delete localStorage
        return false
    }
}

var cachedJSONAsync = function (url, callback, error) {
    getJSONAsync(url, function (data) {
        console.log("Updating " + url)
        callback(data)
    }, error)
}

var lookup = function (input, offset, callback, error) {
    input = input.trim()

    console.log(input)
    if (/^[0-9a-fA-F]{64}$/.test(input)) {
        cachedJSONAsync("https://blockchain.info/rawtx/" + input + "?cors=true", function (transaction) {
            lookup(transaction["inputs"][0]["prev_out"]["addr"], 0, callback, error)
        }, error)
    }
    else if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(input)) {
        cachedJSONAsync("https://blockchain.info/multiaddr?active=" + input + "&n=100&offset=" + offset + "&cors=true", callback, error)
    }
}

var dollarsToBitcoin = -1;

var estimatedAddreses = new Map()
var discoveredAddresses = new Map()
var discoveredLinks = new Set()
var linkedAddresses = new Map()
var taintedAddresses = new Map()
var taintOrigin = ""
var taintValue = ""

var dateMin = new Date("2000").getTime() / 1000
var dateMax = new Date("3000").getTime() / 1000

var linksMax = 200;

var updateBlockchain = function (address, result, offset, distance) {
    // console.log(address, offset)
    window.location.hash = "!" + address
    document.getElementById('hash').value = address

    // Colour the very first one differently
    if (!estimatedAddreses.has(address)) {
        if (address in addressTags) {
            nodes.push({ id: address, group: 0, label: addressTags[address].n + " " + address, distance: distance })
        }
        else if (address in jsonList) {
            nodes.push({ id: address, group: 1, label: jsonList[address].Name + " " + address, distance: distance })
        }
        else {
            nodes.push({ id: address, group: 1, label: addr, distance: distance })
        }
        estimatedAddreses.set(address, 0)
    }

    dollarsToBitcoin = result["info"]["symbol_local"]["conversion"]

    for (var addr of result["addresses"]) {
        discoveredAddresses.set(addr.address, addr)
    }

    if (result["txs"].length > 0) {
        for (var transaction of result["txs"]) {
            if (transaction["time"] < dateMin || transaction["time"] > dateMax) continue

            for (var inputs of transaction["inputs"]) {
                var hash = transaction["hash"]

                for (var out of transaction["out"]) {
                    var source = inputs["prev_out"]["addr"]
                    var target = out["addr"]
                    if (typeof source == "undefined" || typeof target == "undefined") continue

                    if (!discoveredLinks.has(source + target)) {
                        discoveredLinks.add(source + target)
                        links.push({ source: source, target: target, strength: 0.7 })
                    }

                    if (!linkedAddresses.has(source)) linkedAddresses.set(source, { "in": new Map(), "out": new Map(), "all": new Map(), "hash": transaction['hash'] })
                    if (!linkedAddresses.has(target)) linkedAddresses.set(target, { "in": new Map(), "out": new Map(), "all": new Map(), "hash": transaction['hash'] })
                    linkedAddresses.get(source)["out"].set(transaction['hash'], transaction)
                    linkedAddresses.get(target)["in"].set(transaction['hash'], transaction)
                    linkedAddresses.get(source)["all"].set(transaction['hash'], transaction)
                    linkedAddresses.get(target)["all"].set(transaction['hash'], transaction)
                }
            }

            for (var inputs of transaction["inputs"]) {
                var addr = inputs["prev_out"]["addr"]
                if (typeof addr == "undefined" || typeof inputs == "undefined") continue

                if (!estimatedAddreses.has(addr)) {
                    var actualDistance = distance + (discoveredLinks.has(address + addr) ? (discoveredLinks.has(addr + address) ? 0 : 1) : (discoveredLinks.has(addr + address) ? - 1 : 0))
                    if (addr in addressTags) {
                        nodes.push({ id: addr, group: 1, label: addressTags[addr].n + " " + addr, distance: actualDistance })
                    }
                    else if (addr in jsonList) {
                        nodes.push({ id: addr, group: 1, label: jsonList[addr].Name + " " + addr, distance: actualDistance })
                    }
                    else {
                        nodes.push({ id: addr, group: 1, label: addr, distance: actualDistance })
                    } estimatedAddreses.set(addr, 0)
                } else {
                    estimatedAddreses.set(addr, Math.max(0, estimatedAddreses.get(addr) - inputs["prev_out"]["value"]))
                }
            }

            for (var out of transaction["out"]) {
                var addr = out["addr"]
                if (typeof addr == "undefined" || typeof out == "undefined") continue
                if (!estimatedAddreses.has(addr)) {
                    estimatedAddreses.set(addr, out["value"])
                    var actualDistance = distance + (discoveredLinks.has(address + addr) ? (discoveredLinks.has(addr + address) ? 0 : 1) : (discoveredLinks.has(addr + address) ? - 1 : 0))
                    if (addr in addressTags) {
                        nodes.push({ id: addr, group: 1, label: addressTags[addr].n + " " + addr, distance: actualDistance })
                    }
                    else if (addr in jsonList) {
                        nodes.push({ id: addr, group: 1, label: jsonList[addr].Name + " " + addr, distance: actualDistance })
                    }
                    else {
                        nodes.push({ id: addr, group: 1, label: addr, distance: actualDistance })
                    }
                } else {
                    estimatedAddreses.set(addr, estimatedAddreses.get(addr) + out["value"])
                }
            }
        }

        while (links.length > linksMax) links.shift();

        updateSimulation()
    }

    if (result["txs"].length == 100) {
        // Recurse
        if (offset == 0 || offset % 100 != 0 || (offset % 100 == 0 && confirm("Continue loading next 100 transactions?"))) {
            lookup(address, offset + 100, function (result) { updateBlockchain(address, result, offset + 100, distance) }, function (status) {
                console.error("Error", status)
                M.toast({ html: "Error:" + status, displayLength: Infinity })
            })
        }
    }
}

testLocalStorage()

var trace = function (hash) {
    M.toast({ html: 'Loading ' + hash, displayLength: 2000 })

    nodes = []
    links = []

    estimatedAddreses = new Map()
    discoveredAddresses = new Map()
    discoveredLinks = new Set()
    linkedAddresses = new Map()

    lookup(hash, 0, function (result) { updateBlockchain(hash, result, 0, 0) }, function (status) {
        console.error("Error", status)
        M.toast({ html: "Error:" + status, displayLength: Infinity })
    })
    return false
}

var traceTransactionOut = function (address, hash, index) {

    var item = linkedAddresses.get(address)["all"].get(hash)
    var firstelement = { "data": item["out"][index], "time": item["time"], "haircut": 1.0, "fifo": item["out"][index]["value"] }
    var queue = new PriorityQueue()
    var seen = new Set()
    queue.push(firstelement)
    seen.add(hash)


    taintedAddresses = new Map()
    taintOrigin = address
    taintValue = item["out"][index]["value"]


    while (queue.size() > 0) {
        var item = queue.pop()
        var balance = discoveredAddresses.has(item["data"]["addr"]) ? discoveredAddresses.get(item["data"]["addr"])["final_balance"] : estimatedAddreses.get(item["data"]["addr"])
        var fifobalance = item["fifo"]

        if (linkedAddresses.has(item["data"]["addr"])) {
            var transactions = Array.from(linkedAddresses.get(item["data"]["addr"])["out"].values())
            transactions.sort(function (a, b) { return a["time"] - b["time"] })

            for (var transaction of transactions) {
                if (seen.has(transaction["hash"])) continue
                seen.add(transaction["hash"])

                if (transaction["time"] > item["time"]) continue

                for (var i = 0; i < transaction["out"].length; i++) {
                    var fifoout = Math.min(fifobalance, transaction["out"][i]["value"])
                    fifobalance -= fifoout

                    queue.push({
                        "data": transaction["out"][i],
                        "time": transaction["time"],
                        "fifo": fifoout
                    })
                }
            }
        }

        if (!taintedAddresses.has(item["data"]["addr"])) {
            taintedAddresses.set(item["data"]["addr"], { "poison": true, "fifo": fifobalance })
        } else {
            var oldvalues = taintedAddresses.get(item["data"]["addr"])
            taintedAddresses.set(item["data"]["addr"], { "poison": true, "fifo": oldvalues["fifo"] + fifobalance })
        }
    }



    if (fillStyle < 2) fillStyle = 2
    updateFillStyle(fillStyle)
}

var traceTransactionIn = function (address, hash, index) {

    var item = linkedAddresses.get(address)["all"].get(hash)
    var firstelement = { "data": item["inputs"][index]["prev_out"], "time": item["time"], "haircut": 1.0, "fifo": item["inputs"][index]["prev_out"]["value"] }
    var queue = new PriorityQueue()
    var seen = new Set()
    queue.push(firstelement)
    seen.add(hash)


    taintedAddresses = new Map()
    taintOrigin = address
    taintValue = item["inputs"][index]["prev_out"]["value"]

    while (queue.size() > 0) {
        var item = queue.pop()
        var balance = discoveredAddresses.has(item["data"]["addr"]) ? discoveredAddresses.get(item["data"]["addr"])["final_balance"] : estimatedAddreses.get(item["data"]["addr"])
        var fifobalance = item["fifo"]
    
        if (linkedAddresses.has(item["data"]["addr"])) {
            var transactions = Array.from(linkedAddresses.get(item["data"]["addr"])["out"].values())
            transactions.sort(function (a, b) { return a["time"] - b["time"] })
    
            for (var transaction of transactions) {
                if (seen.has(transaction["hash"])) continue
                seen.add(transaction["hash"])
    
                if (transaction["time"] > item["time"]) continue
    
                for (var i = 0; i < transaction["out"].length; i++) {
                    var fifoout = Math.min(fifobalance, transaction["out"][i]["value"])
                    fifobalance -= fifoout
    
                    queue.push({
                        "data": transaction["out"][i],
                        "time": transaction["time"],
                        "fifo": fifoout
                    })
                }
            }
        }
    
        if (!taintedAddresses.has(item["data"]["addr"])) {
            taintedAddresses.set(item["data"]["addr"], { "fifo": fifobalance })
        } else {
            var oldvalues = taintedAddresses.get(item["data"]["addr"])
            taintedAddresses.set(item["data"]["addr"], { "fifo": oldvalues["fifo"] + fifobalance })
        }
    }
}