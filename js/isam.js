var gcounts = {
    recursion_level: 0,
    recursion_depth: 64
};

Number.prototype.base=function(fractionDigits){
    return this.toExponential(fractionDigits).slice(0, this.toExponential(fractionDigits).indexOf("e"));
};

Number.prototype.exponent=function(fractionDigits){
    return this.toExponential(fractionDigits).slice(this.toExponential(fractionDigits).indexOf("e")+1);
};

var esdId;

var esd = {
    events: [],
    fid: function (id){
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
    }
};

function displayValue(id, newval){
    console.log("ID:"+id+" VAL:"+newval);
    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    switch(esd.fid(id).type){
        case "PIVOTAL":
            esd.fid(id).probability=newval;
            $("#current_"+id).text(esd.fid(id).probability);
            break;
        case "INITIATING":
            esd.fid(id).frequency=newval;
            $("#current_"+id).text(esd.fid(id).frequency);
            break;
    }    
    esd.barriers().forEach(function(e){console.log(e.name+' '+e.probability)});
    esd.calculate();
    drawChart();
}

function showValue(newValue)
{
//	document.getElementById("range").innerHTML=newValue;
//	document.getElementById("range1").value=newValue;
	$("#range").text(newValue);
	$("#range2").val(newValue);
}

function showSlider(b){
    $("#sliders").append("<p><span>"+b.name+"</span></p>");
    $("#sliders").append("<p>");
    $("#sliders").append("<span>"+b.uniqueId+"</span>");
    $("#sliders").append(b.uniqueID);    
    switch(b.type){
        case "PIVOTAL":
            $("#sliders").append("<input type=range id="+b.id+" min=0.00000001 max=1 step=.00000001 value="+b.probability+" onchange=displayValue(this.id,this.value) />");
            $("#sliders").append("<span id=current_"+b.id+">"+b.probability+"</span>");
            break;
        case "INITIATING":
            $("#sliders").append("<input type=range id="+b.id+" min=0.00000001 max=1 step=.00000001 value="+b.frequency+" onchange=displayValue(this.id,this.value) />");
            $("#sliders").append("<span id=current_"+b.id+">"+b.frequency+"</span>");
            break;
    }
    $("#sliders").append("</p>");
}

function drawChart() {
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
        bar: {groupWidth: "95%"},
        legend: { position: 'right', maxLines: 10 },
//        legend: { position: "none" },
        isStacked: true
    };

      // Instantiate and draw the chart.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    }


$(document).ready(function() {
    $.ajax({
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/45",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
      google.charts.load('current', {packages: ['corechart']});
      google.charts.setOnLoadCallback(drawChart);
        esd.events = data.events;
        esdId = data.uniqueId;
//        console.log(esd.fid(440));
//       esd.calculate();
       console.log(esd.outcomes());
       console.log(esd.barriers());
       esd.initiating().forEach(showSlider);
       esd.barriers().forEach(showSlider);
       $('.esd-id').append(data.uniqueId);
       $('.esd-desc').append(data.description);
    });
});