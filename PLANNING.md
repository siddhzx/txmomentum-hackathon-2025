High level goals:
1. Research
2. Application
3. Pitch

Team Members:
Siddhant Singh
- vggt world model creation
  - use VGGT to generate a world picture timestamp in current working memory. This will then get passed into a longer term slide memory.


References:
1. CVPR 2025
   1. https://vgg-t.github.io/
   2. https://github.com/facebookresearch/vggt


Noah Philip 

Yu Cao
Personal Pain Points:
1. Cannot find the right file or right data among thousands of data file （including code scripts(python), pictures/figures, pdfs, powerpoint and raw files in different directories)
	Temporary solution: Notion (paid), file directory
	Root Cause: 

Missing or inconsistent metadata 
Incoherent naming conventions
no single source of truth for the mapping “run_id → parameters → outputs

	Who is this problem for:
	Computational/experimental research labs, national labs, deep-tech startups, enterprise R&D groups, data-heavy consulting teams.

This is a common pain point felt by people for decades. Thus solutions like notion, trello, sharepoint exist. 

2. I want to understand (my and others’) files and projects in a more intuitive way that saves time. 
For example, asking the AI to pinpoint the file’s location and what is the relevant context that creates this file. 
Or, understanding what other people have been doing in a team or collaboration. 
Or, my professor wants to find a specific plot I made but he couldn’t be sure which one is the right plot. Does this plot do the thing he wants?
Temporary solution: We are building something right now with the BNL team. 

Root Cause:
No standardization of how to manage files (especially in niche industries and research). Example: how to name those files, where to put them, and how to restructure into a database, etc
Not many people write documentation for each file. 

Who is the problem for:
PIs, staff scientists, postdocs, grad students, engineering managers, program managers who must audit/review.



Other company’s pain points: Communicating between silos, communicating data directly with others, and reporting progress in teams. (have to arrange meetings, communication is inefficient)   
—A few people from software companies reported this 

3. Pain with current AI solutions: I don’t want to tell chatGPT every single detail I have on my project every single time. I want the AI to understand me, not everything else that is not of interest to me. 
Each time when my question is a bit different, chatgpt fails to understand my actual need. Not everyone is good at prompt engineering. 
	May need a domain-personal specific AI: By human input, it understands all the contexts I have for this specific project. 
For example, I want to understand why I did this simulation? 
I want to ask someone else’s AI why he did this thing this way in particular? 
Temporary solution: Provide all the details every time I ask chat/gpt. Prompt it to ask back questions to clarify.  

Root Cause:

Who is the problem for: 
Anyone who queries often (PIs, team leads, analysts), non-experts who can’t “prompt engineer,” and time-constrained decision-makers.

4.  Lost knowledge:  No long-term (cheap) data storage and knowledge preservation solutions available. No easy-to-access or easy-to-transfer-knowledge solutions exist. Knowledge is lost during this process.
The current solution to data storage relies on cloud platforms. But we can not solve problem 2 in this scenario.
Knowledge preservation becomes very hard (1. Hard to understand, 2. Hard to preserve) after the person creating this knowledge leaves or switches directions. People forget about the things they know. 


Additionally, long-term data preservation with tools like notion or sharepoint (that is better at problem #2) is expensive. People resort to local hard drives (cannot solve problem #1) or local clouds that are either expensive or need maintenance. 

Other company‘s pain point: Boeing, DOE, national labs (research heavy companies or institutions) 
— Huge number of cut projects and tasks. Mostly stored in paper libraries or local hard drives. Nobody understands those files unless you spend months learning about it. 
— Some specific experimental work are only operable by specialized personnel (who are usually busy) and specific custom components (usually very expensive, not provided in general markets). Delayed progress happens very frequently due to these situations. 
— Collaborative research progress delayed by one key personnel/key component. Knowledge to make it to work is not available to other collaborating members. (Personal interest of keeping things confidential conflicts with general interest of company/community)


Root Cause:

Who is the problem for: 
National labs, aerospace/energy primes, pharma, university labs between funding cycles, any org with long project half-lives.

 
5. AI forgetfulness (for solving problem 4): AI cannot memorize all the stuff if the conversation continues too long. It cannot memorize what I have done before. 

	Root Cause:
I don’t want to spend time providing contexts in too much detail. I don’t want to retype the same information again and again. (Side effect of general public using AI as non-experts)

Who is the problem for: 


6. AI to solve stuff that has not been trained on, or has very little knowledge available. How to train AI to understand your own files/knowledge?

	Root Cause:

Who is the problem for: 

7. Data curation for custom data. I cannot easily restructure my project into a structured database format. I want to do ML tasks but cannot create data pipelines easily as a non-programmer. 

Root Cause:

Who is the problem for: 

8. Other company‘s pain point: 
Data Privacy. (Tau systems, UT research labs/national labs generally reports concern about this)
Programmers too expensive; while programs too old and not maintained (Tau systems, Brookhaven national lab)
	
Root Cause:

Who is the problem for: National labs/defense/regulated R&D, mid-market deep-tech with thin platforms teams.

9. Convert the documents automatically from unstructured format to structured format (csv, database). 
	
Root Cause:

Who is the problem for: 
Any team producing reports, theses, procedures, logbooks, and papers at scale.



- We see all of the ""
- We need some way of verifying 