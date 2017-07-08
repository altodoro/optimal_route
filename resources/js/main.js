var app = angular.module('myApp', []);
app.controller('myCtrl', function($scope, $http) {
    $scope.departureLocations = [];
    $scope.arrivalLocations = [];
    $scope.searchresults = null;

    factoryLocations = function(type, apidata) {
        return _.map(apidata, function(data) {
            return data[type]; }).reduce(function(acc, el) {
            if (acc.indexOf(el) < 0) {
                acc.push(el);
            }
            return acc;
        }, []).sort();
    }

    buildGraphMaps = function() {
        $scope.shortestMap = {};
        $scope.cheapestMap = {};
        $scope.durationsMap = {};
        $scope.costsMap = {};
        function searchResult(items) {
            this.items = items || [];
            this.update(this.items);
        }
        searchResult.prototype.update = function(items) {
            this.items = items = items || [];
            var totals = this.calcTotal(items);
            this.totalCost = totals.totalCost;
            this.totalDuration = totals.totalDuration;
        }
        searchResult.prototype.calcTotal = function(items) {
            return items.reduce(function(acc, item) {
                _.each(['netCost', 'duration'], function(prop) {
                    if (item[prop] instanceof Object) {
                        // case for duration calculation
                        console.log(item);
                        acc.totalDuration.h += parseFloat(item[prop].h);
                        acc.totalDuration.h += Math.floor((acc.totalDuration.m + parseFloat(item[prop].m)) / 60);
                        acc.totalDuration.m = (acc.totalDuration.m + parseFloat(item[prop].m)) % 60;
                    } else {
                        acc.totalCost += item[prop]
                    }
                });
                return acc;
            },
                { 'totalCost': 0, 'totalDuration': { 'h': 0, 'm': 0 } }
            );
        }
        $scope.searchResult = new searchResult();

        _.each($scope.departureLocations, function(departureName) {
            $scope.durationsMap[departureName] = {};
            $scope.costsMap[departureName] = {};
        });
        _.each($scope.deals, function(deal) {
            if (
                _.isEmpty($scope.shortestMap[deal.departure + ' > ' + deal.arrival]) ||
                _.isEmpty($scope.cheapestMap[deal.departure + ' > ' + deal.arrival])
            ) {
                var route = getBestRoute(deal.departure, deal.arrival);
                $scope.durationsMap[deal['departure']][deal.arrival] = route.fast.durationHours;
                $scope.costsMap[deal['departure']][deal.arrival] = route.cheap.netCost;
                $scope.shortestMap[deal.departure + ' > ' + deal.arrival] = route.fast;
                $scope.cheapestMap[deal.departure + ' > ' + deal.arrival] = route.cheap;
            }
        });

        graphDuration = $scope.graphDuration = new Graph($scope.durationsMap);
        graphCost = $scope.graphCost = new Graph($scope.costsMap);
    }

    getBestRoute = function(from, to) {
        return $scope.deals.filter(function(deal) {
            return deal.departure === from && deal.arrival === to;
        }).reduce(function(acc, deal, index, arr) {
            var dealNetCost = (function(obj) {
                    return obj.cost * (100 - obj.discount) / 100;
                })(deal),
                dealDurationHours = (function(obj) {
                    return parseFloat(obj['duration']['h']) + parseFloat(obj['duration']['m']) / 60;
                })(deal);
            var updateRoute = function(obj, prop, deal, cost, duration) {
                _.extend(obj[prop], deal, {'netCost': dealNetCost, 'durationHours': dealDurationHours});
            };
            if (_.isEmpty(acc['cheap']) || acc['cheap']['netCost'] > dealNetCost) {
                updateRoute(acc, 'cheap', deal, dealNetCost, dealDurationHours);
            }
            if (_.isEmpty(acc['fast']) || acc['fast']['durationHours'] > dealDurationHours) {
                updateRoute(acc, 'fast', deal, dealNetCost, dealDurationHours);
            }
            return acc;
        }, { 'cheap': {}, 'fast': {} });
    }

    $http({
        method: "GET",
        url: "resources/data/response.json"
    }).then(function(response) {
        if (response.statusText === "OK" && response.data && !_.isEmpty(response.data.deals)) {
            // validation of data scheme should be here
            $scope.departureLocations = factoryLocations('departure', response.data.deals);
            $scope.arrivalLocations = factoryLocations('arrival', response.data.deals);
            $scope.deals = response.data.deals;
            buildGraphMaps();
        }
    }, function(res) {
        console.log('oops, something went wrong', res);
    });


    function onDepartureChanged(argument) {
        $scope.from = argument;
    }

    function onArrivalChanged(argument) {
        $scope.to = argument;
    }

    getSearchGraph = function() {
        return $scope.searchType && ($scope.searchType === 'fast' ? $scope.graphDuration : $scope.graphCost) || null;
    }
    getRoutesMap = function() {
        return $scope.searchType && ($scope.searchType === 'fast' ? $scope.shortestMap : $scope.cheapestMap) || null;
    }

    $scope.doSearch = function() {
        $scope.searchResult.update(
            buildOptimalRoute(
                getSearchGraph().findShortestPath($scope.from, $scope.to), getRoutesMap()
            )
        );
    }

    $scope.$watch('departureSelect', onDepartureChanged);
    $scope.$watch('arrivalSelect', onArrivalChanged);
    $scope.switchLocation = function() {
        var beforeFrom = $scope.from;
        $scope.departureSelect = $scope.to;
        $scope.arrivalSelect = beforeFrom;
    }
    $scope.reset = function() {
        $scope.departureSelect = null;
        $scope.arrivalSelect = null;
        $scope.searchResult.update();
    }
    /*
    * path as array of strings - Locations names
    * return array of objects - optimal deals
    */
    buildOptimalRoute = function(path, routesMap) {
        var res = [];
        while (path.length > 1 ) {
            res.push(routesMap[path.shift() + ' > ' + path[0]]);
        }
        return res;
    }
    $scope.cheapSearch = function() {
        $scope.searchResult.update(buildOptimalRoute($scope.graphCost.findShortestPath($scope.from, $scope.to), $scope.cheapestMap));
    };
    $scope.fastSearch = function() {
        $scope.searchResult.update(buildOptimalRoute($scope.graphDuration.findShortestPath($scope.from, $scope.to), $scope.shortestMap))
    };

});