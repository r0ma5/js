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
            event._frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
            console.log("result:"+event._frequency);
            return;
        } else if (event.type == "PIVOTAL"){
            event._frequency = event.parentRelationType == "YES" ? freq*prb : freq*(1.0-prb);
            console.log("result:"+event._frequency);
            event.childIds.forEach(function(i){this.calculate(this.fid(i), event._frequency,event.probability)},this);
        }
    }
};

function displayValue(id, newval){
    console.log("ID:"+id+" VAL:"+newval);
    console.log(esd.fid(id).probability);
//    console.log(esd.fid(id).probability.exponent());
    esd.fid(id).probability=newval;
    $("#current_"+id).text(esd.fid(id).probability);
    esd.calculate();
}

function showValue(newValue)
{
//	document.getElementById("range").innerHTML=newValue;
//	document.getElementById("range1").value=newValue;
	$("#range").text(newValue);
	$("#range2").val(newValue);
}

function showSlider(b){
    $("#sliders").append("<p>");
    $("#sliders").append("<span>"+b.uniqueId+"</span>");
    $("#sliders").append(b.uniqueID);    
//    $("#sliders").append("<input type=range id="+b.id+" min=0.000001 max=1 step=.001 value="+Math.round(b.probability.base())+" onchange=displayValue(this.id,this.value) />");
    $("#sliders").append("<input type=range id="+b.id+" min=0.000001 max=1 step=.000001 value="+b.probability+" onchange=displayValue(this.id,this.value) />");
    $("#sliders").append("<span id=current_"+b.id+">"+b.probability+"</span>");
    $("#sliders").append("</p>");
}

$(document).ready(function() {
    $.ajax({
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/45",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
        esd.events = data.events;
//        console.log(esd.fid(440));
       esd.calculate();
       console.log(esd.outcomes());
       console.log(esd.barriers());
       esd.barriers().forEach(showSlider);
       $('.greeting-id').append(data.uniqueId);
       $('.greeting-content').append(data.description);
    });
});