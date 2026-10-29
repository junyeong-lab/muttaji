// Shared provider-neutral output contract; validated again against input evidence.
const str={type:"string",minLength:1,maxLength:1500};
const list=(items,maxItems)=>({type:"array",items,maxItems});
const object=properties=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
export const suggestionSchema=object({schemaVersion:{type:"integer",enum:[1]},revision:str,mode:{type:"string",enum:["model-suggestion"]},needsHumanReview:{type:"boolean",enum:[true]},items:list(object({
 id:str,postingQuote:str,interpretation:str,taskType:{type:"string",enum:["technical","management","mixed","unclear"]},
 keySkills:list(object({name:str,quote:str}),12),profileEvidence:list(object({field:{type:"string",enum:["goal-job","education","experience","certs","skills"]},quote:str}),8),
 proposedStatus:{type:"string",enum:["확인 필요","충족","부분 충족","미충족"]},reason:str,missing:list(str,8),actions:list(str,8),certifications:list(object({id:str,reason:str,postingQuote:str}),5)
}),20)});

// Bind the output contract to this request, rather than asking the model to guess IDs.
export function schemaForRequest({request,requirements,catalog,semantic=false}){
 const schema=structuredClone(suggestionSchema);
 schema.properties.revision={type:"string",enum:[request.revision]};
 const items=schema.properties.items;
 items.minItems=requirements.length;items.maxItems=requirements.length;
 items.items.properties.id={type:"string",enum:requirements.map(x=>x.id)};
 const certs=items.items.properties.certifications;
 if(catalog.length)certs.items.properties.id={type:"string",enum:catalog.map(x=>x.id)};
 else certs.maxItems=0;
 if(semantic){
  const choice=values=>({type:"string",enum:values});
  const optionalQuote={type:"string",maxLength:1500};
  const units=list(object({quote:str,obligation:choice(["required","preferred","not_required","unclear"]),roleScope:choice(["common","specific","unclear"]),roleQuote:optionalQuote,applicantType:choice(["common","new","experienced","unclear"]),applicantQuote:optionalQuote,relation:choice(["start","and","or","unclear"])}),8);
  units.minItems=1;
  items.items.properties.semantics=object({units,uncertainties:list(object({quote:str,reason:str}),4)});
  items.items.required.push("semantics");
 }
 return schema;
}
