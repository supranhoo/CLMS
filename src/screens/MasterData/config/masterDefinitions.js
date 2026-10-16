const yn = [{value:"Y",label:"Yes"},{value:"N",label:"No"}];
const field = (name,label,extra={}) => ({name,label,...extra});

export const MASTER_DEFINITIONS = {
  "shift-groups": {
    title:"Shift Groups", subtitle:"Define fixed or flexi attendance rules", keyFields:["sh_group"],
    columns:["sh_group","sh_group_desc","sh_group_type","sh_shift_hours","ot_eligible"],
    fields:[field("sh_group","Group Code",{required:true,maxLength:6}),field("sh_group_desc","Description",{required:true,maxLength:25}),field("sh_group_type","Group Type",{required:true,type:"select",options:[{value:"SL",label:"Shift Logic"},{value:"PR",label:"Punch Rules"}]}),field("sh_shift_hours","Shift Hours",{type:"time",seconds:true}),field("sh_flexi_min_mnts_full","Full-day Minutes",{required:true,type:"number",defaultValue:0}),field("sh_flexi_min_mnts_half","Half-day Minutes",{required:true,type:"number",defaultValue:0}),field("sh_halfday_allowd","Half Day Allowed",{type:"select",options:yn}),field("sh_fullday_allowed","Full Day Allowed",{type:"select",options:yn}),field("ot_eligible","OT Eligible",{type:"select",options:yn})]
  },
  "shift-times": {
    title:"Shift Timings", subtitle:"Maintain punch windows, grace and off-time rules", keyFields:["sh_code"],
    columns:["sh_code","sh_group","sh_start_time","sh_end_time","shift_hours","shift_day_night"],
    sections:[{title:"Shift",fields:["sh_code","sh_group","shift_day_night","shift_hours"]},{title:"Working Window",fields:["sh_start_time","sh_end_time","sh_tolerence_start","sh_tolerence_end","sh_tolerence_out","sh_grace_time"]},{title:"Half / Full Day Cut-offs",fields:["sh_hday_off_start","sh_fday_off_start","sh_hday_off_out","sh_fday_off_out"]}],
    fields:[field("sh_code","Shift Code",{required:true,maxLength:3}),field("sh_group","Shift Group",{type:"lookup",lookup:"shiftGroups"}),field("shift_day_night","Day / Night",{type:"select",options:[{value:"D",label:"Day"},{value:"N",label:"Night"}]}),field("shift_hours","Shift Hours",{type:"time",seconds:true}),...['sh_start_time','sh_end_time','sh_tolerence_start','sh_tolerence_end','sh_grace_time','sh_hday_off_start','sh_fday_off_start','sh_tolerence_out','sh_hday_off_out','sh_fday_off_out'].map(n=>field(n,n.split('_').slice(1).map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),{type:"time",seconds:true,required:true}))]
  },
  "business-units": {title:"Business Units",subtitle:"Maintain business units and their legal entity",keyFields:["bu_code"],columns:["bu_code","bu_name","entity_code"],fields:[field("bu_code","BU Code",{required:true,maxLength:5}),field("bu_name","Business Unit Name",{required:true,maxLength:50}),field("entity_code","Entity",{type:"lookup",lookup:"entities"})]},
  cities: {title:"Cities",subtitle:"Maintain city and state mappings",keyFields:["city_code","state_code"],columns:["city_code","city_name","state_code"],fields:[field("city_code","City Code",{required:true,maxLength:100}),field("city_name","City Name",{required:true,maxLength:100}),field("state_code","State Code",{required:true,maxLength:2})]},
  divisions: {title:"Divisions",subtitle:"Maintain entity-wise operating divisions",keyFields:["Div_code","entity_code"],columns:["Div_code","div_name","entity_code","div_group"],fields:[field("Div_code","Division Code",{required:true,maxLength:2}),field("div_name","Division Name",{required:true,maxLength:45}),field("entity_code","Entity",{required:true,type:"lookup",lookup:"entities"}),field("div_group","Division Group",{maxLength:5})]},
  holidays: {title:"Holiday Calendar",subtitle:"Maintain general and contractor-specific holidays",keyFields:["hol_date"],columns:["hol_date","hol_name","contractor_id"],fields:[field("hol_date","Holiday Date",{required:true,type:"date"}),field("hol_name","Holiday Name",{required:true,maxLength:50}),field("contractor_id","Contractor",{type:"lookup",lookup:"contractors",allowBlank:true,blankLabel:"All Contractors"})]},
  locations: {title:"Locations",subtitle:"Maintain employee and payroll locations",keyFields:["loc_code"],columns:["loc_code","loc_name"],fields:[field("loc_code","Location Code",{required:true,maxLength:5}),field("loc_name","Location Name",{required:true,maxLength:50})]},
  "cost-centres": {
    title:"Cost Centres",subtitle:"Maintain cost centre codes and names",keyFields:["COST_CODE"],columns:["COST_CODE","COST_NAME"],
    fields:[field("COST_CODE","Cost Code",{required:true,maxLength:5}),field("COST_NAME","Cost Name",{required:true,maxLength:50})]
  }
};

export const MASTER_MENU = [
  ["shift-groups","Shift Groups"],["shift-times","Shift Timings"],["business-units","Business Units"],["cities","Cities"],["divisions","Divisions"],["holidays","Holidays"],["locations","Locations"],["cost-centres","Cost Centres"]
];
