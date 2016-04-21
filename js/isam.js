var gcounts = {
    recursion_level: 0,
    recursion_depth: 64
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
    }
};

function Esd (events) {
    this.events = events || [];
    this.events.forEach(function(e){
        console.log("initial assignment");   
        if (e.faultTree){
            e.ft = new FaultTree(e.faultTree);
            console.log("array of fault tree nodes");
            console.log(e.faultTree.faultTreeNodes);
            console.log("FaultTree object");
            console.log(e.ft);
        } 
    }, this);
};

Esd.prototype = {
    fid: function (id){
        return this.events.find(function(event){return event.id == id;});
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
    barriers: function () {
        return this.events.filter(function(event){return event.type == "PIVOTAL";});
    },
    calculate: function myself (event, freq, prb){
        console.log("--------");
        console.log("recursion level:"+gcounts.recursion_level);
        console.log("f:"+freq);
        console.log("p:"+prb);
        console.log(event);
        if (gcounts.recursion_level++ > gcounts.recursion_depth) return; //safety check to avoid stack issues
        if (event == null || event == undefined){ //find starting point(s)
            gcounts.recursion_level=0;
            console.log("looking for INITIATING event");
            this.initiating().forEach(function(e){this.calculate(e,1,1)}, this);
        } else if (event.type == "INITIATING"){
            console.log("Found INITIATING event");
            console.log(event.childIds);
            event.childIds.forEach(function(i){this.calculate(this.fid(i), event.frequency,1)},this);
        } else if (event.type == "END") {
            event.frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
            console.log("result:"+event.frequency);
            return;
        } else if (event.type == "PIVOTAL"){
            event.frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
            console.log("result:"+event.frequency);
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
    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    switch(esd.fid(id).type){
        case "PIVOTAL":
            esd.fid(id).probability=newval;
            break;
        case "INITIATING":
            esd.fid(id).frequency=newval;
            break;
    }    
    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    esd.calculate();
    drawOutcomesChartLinear();
    drawRiskChartLog();
}

function showSliderTable(b){
    var slider_min = (esd.porf(b.id)/2).toFixed(8);
    var slider_max = (esd.porf(b.id)*1.5).toFixed(8);
    var slider_step = 0.000000001;
    var content = "<table border=0 width=600>"+
    "<tr><td width=50><span>"+b.uniqueId+":</span></td>"+
    "<td width=350><span>"+b.name+"</span></td>"+
    "<td width=200><input id=text_"+b.id+" value="+esd.porf(b.id)+" data-isam-id="+b.id+" onkeyup=displayValue(this)></td>"+
    "</tr><tr><td colspan=3>"+slider_min+
    "<input type=range style=width:400px id=range_"+b.id+" data-isam-id="+b.id+" min="+slider_min+" max="+slider_max+" step="+slider_step+" value="+esd.porf(b.id)+" onchange=displayValue(this) />"+
    slider_max+"</td></tr></table>";
    $("#sliders").append(content);
}

function showSliderPanel(b){
//    var slider_min = (esd.porf(b.id)/2).toFixed(8);
//    var slider_max = (esd.porf(b.id)*1.5).toFixed(8);
    var slider_min = 0;
    var slider_max = 1;
    var slider_step = 0.000000001;
    var content = 
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            "<div class=row>"+
                "<div class=col-md-3>"+b.uniqueId+":</div>"+
                "<div class=col-md-5>"+b.name+"</div>"+
                "<div class=col-md-4><input id=text_"+b.id+" value="+esd.porf(b.id)+" data-isam-id="+b.id+" onkeyup=displayValue(this)></div>"+
            "</div>"+
        "</div>"+
        '<div class="panel-body">'+
            "<div class=row>"+
                "<div class=col-md-1>"+slider_min+"</div>"+
                "<div class=col-md-10><input type=range id=range_"+b.id+" data-isam-id="+b.id+" min="+slider_min+" max="+slider_max+" step="+slider_step+" value="+esd.porf(b.id)+" onchange=displayValue(this) /></div>"+
                "<div class=col-md-1>"+slider_max+"</div>"+
            "</div>"+
        "</div>"+
    "</div>";
    $("#sliders").append(content);
}

function drawOutcomesChartLinear(axle_type) {
    var i=0;
    var j=0;
// Define the chart to be drawn.
    console.log("drawChartLinear");
    esd.outcomes().forEach(function(e){console.log(e.name+' '+e.frequency)});
    var data = new google.visualization.DataTable();
    data.addColumn('string', '');
    esd.initiating().forEach(function(e){
        data.addColumn('number', e.name);
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    console.log(esd.outcomes().sort(sort_outcomes));
    esd.outcomes().sort(sort_outcomes).forEach(function(e){
        data.addColumn('number', e.name);
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    var options = {
        title: esdId,
        width: 600,
        height: 400,
        bar: {groupWidth: "30%"},
        legend: { position: 'right', maxLines: 10 },
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

    console.log(options.series);


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


function drawRiskChartLog() {
    var i=0;
// Define the chart to be drawn.
    console.log("drawChart");
    esd.outcomes().forEach(function(e){console.log(e.name+' '+e.frequency)});
    var data = new google.visualization.DataTable();
    data.addColumn('string', '');
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
        bar: {groupWidth: "30%"},
        legend: { position: 'right', maxLines: 10 },
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
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/636",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
        google.charts.load('current', {packages: ['corechart']});
        google.charts.setOnLoadCallback(drawOutcomesChartLinear);
        google.charts.setOnLoadCallback(drawRiskChartLog);
//      esd.events = data.events;
        esd = new Esd(data.events);        
        esdId = data.uniqueId;
//       esd.calculate();
        console.log(esd.outcomes());
        console.log(esd.barriers());
        esd.initiating().forEach(showSliderPanel);
        esd.barriers().forEach(showSliderPanel);
        $('.esd-id').text(data.uniqueId);
        $('.esd-desc').text(data.description);
    });
});