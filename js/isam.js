var gcounts = {
    recursion_level: 0,
    recursion_depth: 64
};

var esdId;

var esd = {
    events: [],
    fid: function (id){
        return this.events.find(function(event){return event.id == id;});
    },
    porf: function (id){
        switch(this.fid(id).type){
            case "PIVOTAL":
                return this.fid(id).probability;
                break;
            case "INITIATING":
                return this.fid(id).frequency;
                break;    
            default:
                return 0;
        }
        return this.events.find(function(event){return event.id == id;});
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
    drawChart();
    drawChartLog();
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


function drawChart(axle_type) {
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
    esd.outcomes().forEach(function(e){
        data.addColumn('number', e.name)
        data.addColumn({type: 'string', role: 'tooltip'});
    });
    data.addRows(2);
    data.setCell(0, 0, 'Initiating');
    esd.initiating().forEach(function(e){
        data.setCell(0, ++i, e.frequency);
        data.setCell(0, ++i, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
        
    });
    data.setCell(1, 0, 'Outcomes');
    esd.outcomes().forEach(function(e){
        data.setCell(1, ++i, e.frequency);
        data.setCell(1, ++i, e.uniqueId+":"+e.name+" ("+Number(e.frequency).toExponential()+")");
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
        width: 800,
        height: 600,
        bar: {groupWidth: "40%"},
        legend: { position: 'right', maxLines: 10 },
//        legend: { position: "none" },
        isStacked: true,
        vAxis: {
//          scaleType: 'log',
//          ticks: []
//          ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
        }
    };
    options.vAxis = axle_type;

      // Instantiate and draw the chart.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    }


function drawChartLog() {
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
        width: 800,
        height: 600,
        bar: {groupWidth: "40%"},
        legend: { position: 'right', maxLines: 10 },
//        legend: { position: "none" },
        isStacked: true,
        vAxis: {
          scaleType: 'log',
//          ticks: []
//          ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
        }
    };

      // Instantiate and draw the chart.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div_log'));
      chart.draw(data, options);
    }


$(document).ready(function() {
    $.ajax({
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/45",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
      google.charts.load('current', {packages: ['corechart']});
      google.charts.setOnLoadCallback(drawChart);
            google.charts.setOnLoadCallback(drawChartLog);
      esd.events = data.events;
      esdId = data.uniqueId;
//        console.log(esd.fid(440));
//       esd.calculate();
       console.log(esd.outcomes());
       console.log(esd.barriers());
       esd.initiating().forEach(showSliderTable);
       esd.barriers().forEach(showSliderTable);
       $('.esd-id').text(data.uniqueId);
       $('.esd-desc').text(data.description);
    });
});