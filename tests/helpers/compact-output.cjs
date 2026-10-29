exports.toCompact=(value,request)=>{
 const lines=request.posting.split(/\r\n|\r|\n/),lineOf=(q,end)=>q?lines.findIndex((s,i)=>i+1<=end&&s===q)+1:0;
 return {schemaVersion:2,revision:request.revision,mode:'posting-line-classification',complete:true,
 items:[...value.items.map(x=>({line:x.line,endLine:x.endLine,category:x.category,reason:'검증용 모의 분류',basisLine:lineOf(x.basisQuote,x.endLine),roleLine:lineOf(x.roleQuote,x.endLine),applicantLine:lineOf(x.applicantQuote,x.endLine),applicantType:x.applicantType,relation:x.relation})),...value.referenceRanges.map(x=>({...x,category:'reference',basisLine:0,roleLine:0,applicantLine:0,applicantType:'unclear',relation:'single'}))]};
};
