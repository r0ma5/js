var gcounts = {
    esd_recursion_level: 0,
    esd_recursion_depth: 64,
    ft_recursion_level: 0,
    ft_recursion_depth: 1024,
};

var hc_barriers = {
    "US31_11_02_16_Fa1.1.1": "Aircraft on converging flight paths",
    "US31_11_02_16_Fa1.1.2": "Failure of management of developing conflict",
    "US31_11_02_16_Fa1.2":   "Infringement results in collision course", 
    "US31_11_02_16_Fc1.1":   "Unsuccessful TCAS avoidance",
    "US31_11_02_16_Fc1.2":   "Unsuccessful visual avoidance",
    "US31_11_02_16_Fb1":     "ATC does not resolve conflict",
    "US31_11_02_16_Fd1":     "No providence", 
};

var esdId;

var esd;

function sort_outcomes(a,b){
    if (a.outcome == 'NEGATIVE' && b.outcome == 'NEUTRAL') return 1;
    if (a.outcome == 'NEGATIVE' && b.outcome == 'POSITIVE') return 1;
    if (a.outcome == 'NEUTRAL'  && b.outcome == 'POSITIVE') return 1;
    if (a.outcome == 'NEUTRAL'  && b.outcome == 'NEGATIVE') return -1;
    if (a.outcome == 'POSITIVE' && b.outcome == 'NEGATIVE') return -1;
    if (a.outcome == 'POSITIVE' && b.outcome == 'NEUTRAL') return -1;
    return 0;    
}

function FaultTree (ft) {
    this.rootNode = ft.rootNodeId;
    this.nodes = ft.faultTreeNodes || [];
}

FaultTree.prototype = {
    fid: function (id){
        return this.nodes.find(function(node){return node.id == id;});
    },
    fuid: function (uid){
        return this.nodes.find(function(node){return node.uniqueId == uid;});
    },
    calculate: function myself (nid){
        if (gcounts.ft_recursion_level++ > gcounts.ft_recursion_depth) return -1; //safety check to avoid stack issues
        if (nid == null || nid == undefined){
//            console.log("start of the ftree traverse");
            gcounts.ft_recursion_level=0;
            return this.calculate(this.rootNode);
        } else {
            var ftnode = this.fid(nid);
//            console.log("level:"+gcounts.recursion_level+" evaluating ft node:"+nid+" type:"+ftnode.type);
            if (ftnode.type == 'BASE_EVENT'|| ftnode.manual_override){
//                console.log("Evaluated ft node:"+ftnode.uniqueId+" type:"+ftnode.type+" oprob:"+ftnode.probability);
                return ftnode.probability;
            } else if (ftnode.type == 'AND'){
                var and_prob = 1;
                for (var i = 0; i < ftnode.childIds.length; i++){
                    and_prob*=this.calculate(ftnode.childIds[i]);
                }
//                console.log("Evaluated ft node:"+ftnode.uniqueId+" type:"+ftnode.type+" oprob:"+ftnode.probability+" and_prob:"+and_prob);
                return and_prob;
            } else if (ftnode.type == 'OR'){ // Alan: P(A) = 1 – product(1 – P(Bi)) non-mutually excluvie nodes
                var or_prob = 1;
                for (var i = 0; i < ftnode.childIds.length; i++){
                    or_prob*=(1-this.calculate(ftnode.childIds[i]));
                }
                or_prob = 1-or_prob;
//                console.log("Evaluated ft node:"+ftnode.uniqueId+" type:"+ftnode.type+" oprob:"+ftnode.probability+" or_prob:"+or_prob);
                return or_prob;
            } else if (ftnode.type == 'XOR'){
                var xor_prob = 0;
                for (var i = 0; i < ftnode.childIds.length; i++){
                    or_prob+=this.calculate(ftnode.childIds[i]);
                }
//                console.log("Evaluated ft node:"+ftnode.uniqueId+" type:"+ftnode.type+" oprob:"+ftnode.probability+" xor_prob:"+xor_prob);
                return xor_prob;
            }
//            console.log("!!!!!!!!!!!!!!!!!!");
        }
//        console.log("nid:"+nid+"???????????????????");
        return -2;
    }
};

function Esd (events) {
    this.events = events || [];
    this.events.forEach(function(e){
        if (e.faultTree){
            e.ft = new FaultTree(e.faultTree);
            var calculated_pof = e.ft.calculate();
            switch (e.type){
                case "INITIATING":
                    if (e.frequency != calculated_pof){
                        console.log("!!!!!"+e.uniqueId+":"+e.type+":"+e.probability+":"+e.frequency);
                        console.log("!!!!! calculated from ft:"+calculated_pof);
                    }
                    break;
                default:
                    if (e.probability != calculated_pof){
                        console.log("!!!!!"+e.uniqueId+":"+e.type+":"+e.probability+":"+e.frequency);
                        console.log("!!!!! calculated from ft:"+calculated_pof);
                    }
                    break;
            }
        } 
    }, this);
};

Esd.prototype = {
    fid: function (id){
        return this.events.find(function(event){return event.id == id;});
    },
    fuid: function (uid){
        return this.events.find(function(event){return event.uniqueId == uid;});
    },
    events_with_ft: function (){
        return this.events.filter(function(event){return event.ft;});
    },
    porf: function (id){
        switch(this.fid(id).type){
            case "PIVOTAL":
                return this.fid(id).probability;
            case "INITIATING":
                return this.fid(id).frequency;
            default:
                return 0;
        }
    },
    barColor: function (id){
        console.log("barColor"+id+":"+this.fid(id).type);
        switch(this.fid(id).type){
            case "END":
                switch(this.fid(id).outcome){
                    case "POSITIVE":
                        return "green";
                    case "NEGATIVE":
                        return "red";
                    case "NEUTRAL":
                        return "yellow";
                    default:
                        return "blue";
                }
            case "INITIATING":
                return "blue";
            default:
                return "blue";
        }
    },
    initiating: function () {
        return this.events.filter(function(event){return event.type == "INITIATING";});
    },
    outcomes: function () {
        return this.events.filter(function(event){return event.type == "END";});
    },
    non_positive_outcomes: function () {
        return this.events.filter(function(event){return (event.type == "END" && event.outcome != "POSITIVE");});
    },
    barriers: function () {
        return this.events.filter(function(event){return event.type == "PIVOTAL";});
    },
    calculate: function myself (event, freq, prb){
        console.log("--------");
        console.log("recursion level:"+gcounts.esd_recursion_level);
        console.log("f:"+freq);
        console.log("p:"+prb);
        console.log(event);
        if (gcounts.esd_recursion_level++ > gcounts.esd_recursion_depth) return -1; //safety check to avoid stack issues....potential residue from previous calc
        if (event == null || event == undefined){ //find starting point(s)
            gcounts.esd_recursion_level=0;
//            console.log("looking for INITIATING event");
            this.initiating().forEach(function(e){this.calculate(e,1,1)}, this);
        } else if (event.type == "INITIATING"){
//            console.log("Found INITIATING event");
//            console.log(event.childIds);
            //priority are as follows: 1-manual override; 2-ft calculation if ft is present; 3-residual value
            event.frequency=(event.manual_override?event.frequency:(event.ft?event.ft.calculate():event.frequency)); //re-run ft if exists to get correct freq
            event.childIds.forEach(function(i){this.calculate(this.fid(i), event.frequency,1)},this);
        } else if (event.type == "END") {
            event.frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
//            console.log("result:"+event.frequency);
            return;
        } else if (event.type == "PIVOTAL"){
            event.frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
            event.probability=(event.manual_override?event.probability:(event.ft?event.ft.calculate():event.probability)); //re-run ft if exists to get correct probability
//            console.log("result:"+event.frequency);
            event.childIds.forEach(function(i){this.calculate(this.fid(i), event.frequency,event.probability)},this);
        }
    },
};




function displayValue(input){
    var id = $("#"+input.id).data("isam-id");
    var newval = input.value;
    console.log("ID:"+id+" type:"+input.type+" VAL:"+newval);
    switch(input.type){
        case "text":
            $("#range_"+id).val(newval);
            break;
        case "range":
            $("#text_"+id).val(newval);
            break;
    }
//    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    if(esd.fid(id)){ //check if modified value is for esd
        switch(esd.fid(id).type){
            case "PIVOTAL":
                esd.fid(id).probability=newval;
                break;
            case "INITIATING":
                esd.fid(id).frequency=newval;
                break;
        }    
        esd.fid(id).manual_override=1; //marking this node as manual override for stop condiition in tree traverse
    } else {
        esd.events_with_ft().forEach(function(e){
            if(e.ft.fid(id)){
                e.ft.fid(id).probability=newval;
                e.ft.fid(id).manual_override=1;
                console.log(e.ft.fid(id));
            }
        });
    }
//    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    esd.calculate();
    drawOutcomesChartLinear();
    drawNonPositiveOutcomesPieChart();
    drawRiskChartLog();
}

function showSliderTable(b){
    var slider_min = 0;
    var slider_max = 1;
    var slider_step = 0.000000001;
    var slider_value = (b.type?(b.type == 'INITIATING' ? b.frequency:b.probability):b.probability); //esd.porf(b.id)
    var slider_id = "range_"+b.id;
    var text_id = "text_"+b.id;
    var content = 
    "<label for="+slider_id+">"+b.uniqueId+": "+b.name+"</label>"+
    "<input id="+text_id+" value="+slider_value+" data-isam-id="+b.id+" onkeyup=displayValue(this)>"+
    "<span>"+slider_min+"</span>"+
    "<input type=range id="+slider_id+" data-isam-id="+b.id+" min="+slider_min+" max="+slider_max+" step="+slider_step+" value="+slider_value+" onchange=displayValue(this) />"+
    "<span>"+slider_max+"</span>";
    $("#sliders").append(content);
}

function showSliderPanel(b){
//    var slider_min = (esd.porf(b.id)/2).toFixed(8);
//    var slider_max = (esd.porf(b.id)*1.5).toFixed(8);
//    console.log("slider for "+b);
    var slider_min = 0;
    var slider_max = 1;
    var slider_step = 0.000000001;
    var slider_value = (b.type?(b.type == 'INITIATING' ? b.frequency:b.probability):b.probability); //esd.porf(b.id)
    var content = 
    '<div class="panel panel-success">'+
        '<div class="panel-heading">'+
            "<div class=row>"+
                "<div class=col-md-8>"+b.uniqueId+": "+b.name+"</div>"+
                "<div class=col-md-4><input id=text_"+b.id+" value="+slider_value+" data-isam-id="+b.id+" onkeyup=displayValue(this)></div>"+
            "</div>"+
        "</div>"+
        '<div class="panel-body">'+
            "<div class=row>"+
                "<div class=col-md-1>"+slider_min+"</div>"+
                "<div class=col-md-10><input type=range id=range_"+b.id+" data-isam-id="+b.id+" min="+slider_min+" max="+slider_max+" step="+slider_step+" value="+slider_value+" onchange=displayValue(this) /></div>"+
                "<div class=col-md-1>"+slider_max+"</div>"+
            "</div>"+
        "</div>"+
    "</div>";
    $("#sliders").append(content);
}

function showSliderPanel1(b){
//    var slider_min = (esd.porf(b.id)/2).toFixed(8);
//    var slider_max = (esd.porf(b.id)*1.5).toFixed(8);
//    console.log("slider for "+b);
    var slider_min = 0;
    var slider_max = 1;
    var slider_step = 0.000000001;
    var slider_value = (b.type?(b.type == 'INITIATING' ? b.frequency:b.probability):b.probability); //esd.porf(b.id)
    var content = 
//    '<div class="panel panel-success">'+
            "<div class=row>"+
                "<div class=col-md-4>"+b.uniqueId+": "+b.name+"</div>"+
                "<div class=col-md-6><input type=range id=range_"+b.id+" data-isam-id="+b.id+" min="+slider_min+" max="+slider_max+" step="+slider_step+" value="+slider_value+" onchange=displayValue(this) /></div>"+
                "<div class=col-md-2><input id=text_"+b.id+" value="+slider_value+" data-isam-id="+b.id+" onkeyup=displayValue(this)></div>"+
//            "</div>"+
    "</div>";
    $("#sliders").append(content);
}


function drawOutcomesChartLinear(axle_type) {
    var i=0;
    var j=0;
// Define the chart to be drawn.
    console.log("drawChartLinear");
    esd.initiating().forEach(function(e){console.log(e.name+' '+e.frequency)});
    esd.outcomes().forEach(function(e){console.log(e.name+' '+e.frequency)});
    var data = new google.visualization.DataTable();
    data.addColumn('string', '');
    esd.initiating().forEach(function(e){
        data.addColumn('number', e.name);
        data.addColumn({type: 'string', role: 'tooltip'});
    });
//    console.log(esd.outcomes().sort(sort_outcomes));
    esd.outcomes().sort(sort_outcomes).forEach(function(e){
        data.addColumn('number', e.name);
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    var options = {
        title: esdId,
        width: 600,
        height: 400,
        bar: {groupWidth: "40%"},
        legend: { position: 'bottom'},
//        legend: { position: "none" },
        isStacked: true,
        series: {0:{}, 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{}, 7:{}, 8:{}, 9:{}},
        vAxis: {
//          scaleType: 'log',
//          ticks: []
//          ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
        }
    };
    data.addRows(2);
    data.setCell(0, 0, 'Initiating');
    esd.initiating().forEach(function(e){
        options.series[j++].color=esd.barColor(e.id);
        data.setCell(0, ++i, e.frequency);
        data.setCell(0, ++i, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
    });

//    options.series = {
//        0: {color: "blue"},
//        1: {color: "green"},
//        2: {color: "red"},
//        3: {color: "yellow"}
//    };
    
    data.setCell(1, 0, 'Outcomes');
    esd.outcomes().sort(sort_outcomes).forEach(function(e){
        options.series[j++].color=esd.barColor(e.id);
        data.setCell(1, ++i, e.frequency);
        data.setCell(1, ++i, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
    });

//    console.log(options.series);


//    esd.outcomes().forEach(function(e){data.addColumn('number', e.frequency)});
//    data.addColumn('number', 'One');
//   data.addColumn('number', 'Two');
//    data.addColumn('number', 'Three');
//    data.addRows([
//        ['Initiating', 0.0000001, null, null, null],
//        ['Outcomes', null, 0.00000078, 0.00000021, 0.00000001],
//    ]);
    options.vAxis = axle_type;

      // Instantiate and draw the chart.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    }

function drawNonPositiveOutcomesPieChart() {
    var i=0;
    var j=0;
// Define the chart to be drawn.
    console.log("PieChart");
    esd.non_positive_outcomes().forEach(function(e){console.log(e.name+' '+e.frequency)});
    var data = new google.visualization.DataTable();
    data.addColumn('string', '');
    data.addColumn('number', '');
    data.addColumn({type: 'string', role: 'tooltip'});
    var options = {
        title: "Distribution of non-positive outcomes",
        width: 600,
        height: 400,
        pieSliceText: 'label',
        legend: {position: 'bottom'},
        pieSliceTextStyle: {
            color: 'black',
          },
        slices: {0:{}, 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{}, 7:{}, 8:{}, 9:{}},
    };
    data.addRows(esd.non_positive_outcomes().length);
    esd.non_positive_outcomes().sort(sort_outcomes).forEach(function(e){
        options.slices[i].color=esd.barColor(e.id);
        data.setCell(i, 0, e.name);
        data.setCell(i, 1, e.frequency);
        data.setCell(i, 2, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
        i++;
    });

      // Instantiate and draw the chart.
      var chart = new google.visualization.PieChart(document.getElementById('chart_div_pie'));
      chart.draw(data, options);
    }


function drawRiskChartLog() {
    var i=0;
// Define the chart to be drawn.
    console.log("drawChartLog");
    esd.outcomes().forEach(function(e){console.log(e.name+' '+e.frequency)});
    var data = new google.visualization.DataTable();
    data.addColumn('string', '');
    
    for (var b in hc_barriers){
        if(esd.fuid(b)){
            data.addColumn('number', esd.fuid(b).name);
            data.addColumn({type: 'string', role: 'tooltip'});
        } else {
            esd.events_with_ft().forEach(function(e){
                if(e.ft.fuid(b)){
                    data.addColumn('number', e.ft.fuid(b).name);
                    data.addColumn({type: 'string', role: 'tooltip'});
                }
            });
        }
    }
    data.addRows(1);
    data.setCell(0, 0, 'Risk');
    for (var b in hc_barriers){
        if(esd.fuid(b)){
            data.setCell(0, ++i, esd.fuid(b).probability);
            data.setCell(0, ++i, esd.fuid(b).uniqueId+":"+esd.fuid(b).name+" ("+Number(esd.fuid(b).probability).toExponential()+")");
        } else {
            esd.events_with_ft().forEach(function(e){
                if(e.ft.fuid(b)){
                    data.setCell(0, ++i, e.ft.fuid(b).probability);
                    data.setCell(0, ++i, e.ft.fuid(b).uniqueId+":"+e.ft.fuid(b).name+" ("+Number(e.ft.fuid(b).probability).toExponential()+")");
                }
            });
        }
    }
/*    
    esd.initiating().forEach(function(e){
        data.addColumn('number', e.name);
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    esd.barriers().forEach(function(e){
        data.addColumn('number', e.name)
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    data.addRows(1);
    data.setCell(0, 0, 'Risk');
    esd.initiating().forEach(function(e){
        data.setCell(0, ++i, e.frequency);
        data.setCell(0, ++i, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
        
    });
    esd.barriers().forEach(function(e){
        data.setCell(0, ++i, e.probability);
        data.setCell(0, ++i, e.uniqueId+":"+e.name+" ("+Number(e.probability).toExponential()+")");
    });
*/
//    esd.outcomes().forEach(function(e){data.addColumn('number', e.frequency)});
//    data.addColumn('number', 'One');
//   data.addColumn('number', 'Two');
//    data.addColumn('number', 'Three');
//    data.addRows([
//        ['Initiating', 0.0000001, null, null, null],
//        ['Outcomes', null, 0.00000078, 0.00000021, 0.00000001],
//    ]);
    var options = {
        title: esdId,
        width: 600,
        height: 400,
        bar: {groupWidth: "20%"},
        legend: { position: 'bottom', maxLines: 10 },
//        legend: { position: "none" },
        isStacked: true,
        vAxis: {
          scaleType: 'log',
//          ticks: []
//          ticks: [1e-9]
        }
    };

      // Instantiate and draw the chart.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div_log'));
      chart.draw(data, options);
    }


$(document).ready(function() {
    $.ajax({
//        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/45",
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/101202",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
        google.charts.load('current', {packages: ['corechart']});
        google.charts.setOnLoadCallback(drawOutcomesChartLinear);
        google.charts.setOnLoadCallback(drawNonPositiveOutcomesPieChart);
        google.charts.setOnLoadCallback(drawRiskChartLog);
//      esd.events = data.events;
        esd = new Esd(data.events);        
        esdId = data.uniqueId;
//       esd.calculate();
//        console.log(esd.outcomes());
//        console.log(esd.barriers());
//        esd.initiating().forEach(showSliderPanel);
//        esd.barriers().forEach(showSliderPanel);
        for (var b in hc_barriers){
//            console.log(b+":"+hc_barriers[b]);
            if(esd.fuid(b)){
                showSliderPanel1(esd.fuid(b));
            } else {
                esd.events_with_ft().forEach(function(e){
                    if(e.ft.fuid(b)){
//                      console.log(e.ft.fuid(b));
                        showSliderPanel1(e.ft.fuid(b));
                    }
                });
            }
        }
        $('.esd-id').text(data.uniqueId);
        $('#esd-desc').text(data.description);
    });
});