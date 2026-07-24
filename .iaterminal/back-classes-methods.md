# Back CM
<!-- iaterminal:context {"version":1,"id":"iaterminal:symbols:Back-CM","name":"Back CM","fileName":"back-classes-methods.md","kind":"symbols","icon":"code","color":"#c084fc","rootPath":"back","symbolKinds":["class","method"]} -->

<!-- iaterminal:auto -->
### back/src/action-plan/action-plan-message.schema.ts
- ActionPlanMessage:

### back/src/action-plan/action-plan.message.resolver.ts
- ActionPlanMessageResolver: actionPlanMessage, actionPlanMessages, updateMessageInActionPlan, addMessageToActionPlan, deleteMessageInActionPlan, user

### back/src/action-plan/action-plan.module.ts
- ActionPlanModule:

### back/src/action-plan/action-plan.resolver.ts
- ActionPlanResolver: actionPlans, getActionPlan, actionPlanStats, getActionPlanPaginated, createActionPlan, updateActionPlan, deleteActionPlan, updateActionPlanStatus, responsible, dimension, members, messages, tags, numberOfComments

### back/src/action-plan/action-plan.schema.ts
- ActionPlan:

### back/src/action-plan/action-plan.service.ts
- ActionPlanService: createActionPlan, updateActionPlan, updateActionPlanStatus, deleteActionPlan, getAllActionPlan, getActionPlan, addMessageToActionPlan

### back/src/action-plan/event.resolver.ts
- EventResolver: actionPlanMessageAdded, notificationCreated

### back/src/action-plan/inputs/add-message-to-action-plan.input.ts
- AddMessageToActionPlanInput:

### back/src/action-plan/inputs/create-action-plan.input.ts
- CreateActionPlanInput:

### back/src/action-plan/inputs/delete-action-plan.input.ts
- DeleteActionPlanInput:

### back/src/action-plan/inputs/delete-message-in-action-plan.input.ts
- DeleteMessageInActionPlanInput:

### back/src/action-plan/inputs/get-action-plan-message.input.ts
- GetActionPlanMessageInput:

### back/src/action-plan/inputs/get-action-plan-paginated-input.ts
- GetActionPlanPaginatedInput:

### back/src/action-plan/inputs/get-action-plan-stats.input.ts
- GetActionPlanStatsInput:

### src/action-plan/inputs/get-action-plan-status.input.ts
(unavailable or unsupported)

### back/src/action-plan/inputs/get-action-plan.input.ts
- GetActionPlanInput:

### back/src/action-plan/inputs/get-all-action-plan-message.input.ts
- GetAllActionPlanMessageInput:

### back/src/action-plan/inputs/get-all-action-plan.input.ts
- GetAllActionPlanInput:

### back/src/action-plan/inputs/update-action-plan-status.input.ts
- UpdateActionPlanStatusInput:

### back/src/action-plan/inputs/update-action-plan.input.ts
- UpdateActionPlanInput:

### back/src/action-plan/inputs/update-message-in-action-plan.input.ts
- UpdateMessageInActionPlanInput:

### back/src/action-plan/types/action-plan-stats.type.ts
- ActionPlanStats:

### back/src/action-plan/types/get-action-plan-paginated.resp.ts
- IGetActionPlanPaginatedResp:

### back/src/activity/activity.module.ts
- ActivityModule:

### back/src/activity/activity.resolver.ts
- ActivityResolver: activity, seoActivity, publicActivity, activities, createActivity, sendVerificationCode, createRedeemCode, redeemActivity, updateActivity, deleteActivity, activityRegistration, sendTransactionVerificationCode, addMembersToActivity, activityReport, createdBy, invitedUsers, vendorId, userResponse, reactions

### back/src/activity/activity.schema.ts
- Activity:

### back/src/activity/activity.service.ts
- ActivityService: createActivity, getAll, get, seoActivity, publicActivity, update, delete, getById, activityRegistration

### back/src/activity/inputs/add-members-to-activity.input.ts
- AddMembersToActivityInput:

### back/src/activity/inputs/add-reaction.input.ts
- AddReactionInputType:

### back/src/activity/inputs/create-activity.input.ts
- CreateActivityInput:

### back/src/activity/inputs/delete-activity.input.ts
- DeleteActivityInput:

### back/src/activity/inputs/get-activity.input.ts
- GetActivityInput:

### back/src/activity/inputs/get-all-activity-users.input.ts
- GetAllActivityUsersInput:

### back/src/activity/inputs/get-all-activity.input.ts
- GetAllActivityInput:

### back/src/activity/inputs/get-public-activitiy.input.ts
- GetPublicActivityInput:

### back/src/activity/inputs/redeem-activity.input.ts
- RedeemActivityInput:

### back/src/activity/inputs/send-verification-code.input.ts
- SendVerificationCodeInput:

### back/src/activity/inputs/update-activity.input.ts
- UpdateActivityInput:

### back/src/activity/inputs/user-registration.input.ts
- UserRegistrationInput:

### back/src/activity/types/activity-address.type.ts
- ActivityAddress:

### back/src/activity/types/user-activity-answer.type.ts
- UserActivityAnswer:

### back/src/activity/user-activity-answer.resolver.ts
- UserActivityAnswerResolver: activityUsers, user

### back/src/activity/verification-code.schema.ts
- VerificationCode:

### back/src/anonymous-comment/anonymous-answer.resolver.ts
- AnonymousAnswerResolver: anonymousAnswers, answersByCommentId, createAnonymousAnswer

### back/src/anonymous-comment/anonymous-answer.schema.ts
- AnonymousAnswer:

### back/src/anonymous-comment/anonymous-answer.service.ts
- AnonymousAnswerService: getAnswers, getAnswersByCommentId, create

### back/src/anonymous-comment/anonymous-comment.module.ts
- AnonymousCommentModule:

### back/src/anonymous-comment/anonymous-comment.resolver.ts
- AnonymousCommentResolver: anonymousComments, anonymousCommentsById, anonymousCommentsByTracing, createAnonymousComment, assignedAnonymousComment, removeAnonymous, deleteAnonymousComment, answers, userIdAssigned

### back/src/anonymous-comment/anonymous-comment.schema.ts
- AnonymousComment:

### back/src/anonymous-comment/anonymous-comment.service.ts
- AnonymousCommentService: getAnonymousComments, getAnonymousCommentsById, getAnonymousCommentsByTracing, create, assignedAnonymousComment, getAnswers, getAssignedUser, generateRandomNumberString, deleteAnonymousComment, removeAnonymous

### back/src/anonymous-comment/inputs/assigned-anonymous-comment.input.ts
- UpdateAnonymousCommentInput:

### back/src/anonymous-comment/inputs/create-anonymous-answer.input.ts
- CreateAnonymousAnswerInput:

### back/src/anonymous-comment/inputs/create-anonymous-comment.input.ts
- CreateAnonymousCommentInput:

### back/src/app.module.ts
- AppModule: enter

### back/src/appreciation/appreciation-question-option.resolver.ts
- AppreciationQuestionOptionResolver: createAppreciationQuestionOption, appreciationQuestionOptions

### back/src/appreciation/appreciation-question-option.schema.ts
- AppreciationQuestionOption:

### back/src/appreciation/appreciation-question.resolver.ts
- AppreciationQuestionResolver: createAppreciationQuestion, updateAppreciationQuestion, deleteAppreciationQuestion, setTags, appreciationQuestions, dimension, options, tags, createdBy

### back/src/appreciation/appreciation-question.schema.ts
- AppreciationQuestion:

### back/src/appreciation/appreciation.controller.ts
- AppreciationController: createAppreciation, createDistributeAppreciation

### back/src/appreciation/appreciation.module.ts
- AppreciationModule:

### back/src/appreciation/appreciation.resolver.ts
- AppreciationResolver: appreciations, getAppreciationsByDimensions, getAppreciationsPaginated, appreciationSelectedUsers, appreciation, affectedUsers, affectedUsersPaginated, affectedUserIds, appreciationDistributedPaginated, appreciationDistributeGroup, checkCanDistributeAppreciation, createAppreciation, updateAppreciation, distributeAppreciation, deleteAppreciation, setAppreciationPeriodicityCoachUser, friendlyReminder, cloneAppreciation, vendor, dimensions, team, appreciationAffectedUsers, roles, associatedActionPlans, creator, questions, distributed

### back/src/appreciation/appreciation.schema.ts
- Appreciation:

### back/src/appreciation/appreciation.service.ts
- AppreciationService: createAppreciation, updateAppreciation, getAppreciationById, getAppreciations, getAppreciationsByDimensions

### back/src/appreciation/apprecition-distribute.query-user.resolver.ts
- AppreciationDistributeQueryUserLogResolver: appreciationDistributeQueryUserLogByUserId, appreciationDistributeQueryLogByTeamId, appreciation

### back/src/appreciation/dto/create-appreciation.dto.ts
- CreateQuestionOptionDto:
- CreateQuestionDto:
- CreateAppreciationDto:

### back/src/appreciation/dto/create-distribute-appreciation.dto.ts
- CreateDistributeAppreciationDto:

### back/src/appreciation/inputs/appreciation-affected-users.input.ts
- AppreciationAffectedUsersInput:

### back/src/appreciation/inputs/appreciation-ranking.input.ts
- AppreciationRankingInput:

### back/src/appreciation/inputs/appreciation-selected-users.input.ts
- AppreciationSelectedUsersInput:

### back/src/appreciation/inputs/check-can-distribute-appreciation.input.ts
- CheckCanDistributeAppreciationInput:

### back/src/appreciation/inputs/clone-appreciation.input.ts
- CloneAppreciationInput:

### back/src/appreciation/inputs/create-appreciation-question-option.input.ts
- CreateAppreciationQuestionOptionInput:

### back/src/appreciation/inputs/create-appreciation-question.input.ts
- CreateAppreciationQuestionInput:
- CreateAppreciationQuestionInputOption:

### back/src/appreciation/inputs/create-appreciation.input.ts
- CreateAppreciationInput:

### back/src/appreciation/inputs/create-public-appreciation-distribute.input.ts
- CreatePublicAppreciationDistributeInput:

### back/src/appreciation/inputs/delete-appreciation-question.input.ts
- DeleteAppreciationQuestionInput:

### back/src/appreciation/inputs/distribute-appreciation.input.ts
- DistributeAppreciationInput:

### back/src/appreciation/inputs/get-appreciations-dimensions.input.ts
- GetAppreciationsByDimensionInput:

### back/src/appreciation/inputs/get-appreciations-paginated.input.ts
- GetAppreciationsPaginatedInput:

### back/src/appreciation/inputs/get-appreciations.input.ts
- GetAppreciationsInput:

### back/src/appreciation/inputs/get-public-appreciation-filtered.input.ts
- GetPublicAppreciationFilteredDistributeInput:

### back/src/appreciation/inputs/get-public-appreciation.input.ts
- GetPublicAppreciationDistributeInput:

### back/src/appreciation/inputs/get-user-public-appreciation.input.ts
- GetUserPublicAppreciationInput:

### back/src/appreciation/inputs/save-appreciation-distribute.input.ts
- SaveAppreciationDistributeInput:

### back/src/appreciation/inputs/save-public-appreciation-distribute.input.ts
- SavePublicAppreciationDistributeInput:

### back/src/appreciation/inputs/set-appreciation-periodicity-coach-user.input.ts
- SetAppreciationPeriodicityCoachUserInput:

### back/src/appreciation/inputs/set-appreciation-tags.input.ts
- SetAppreciationQuestionTagsInput:

### back/src/appreciation/inputs/update-appreciation-question.input.ts
- UpdateAppreciationQuestionInput:
- UpdateAppreciationQuestionInputOption:

### back/src/appreciation/inputs/update-appreciation.input.ts
- UpdateAppreciationInput:

### back/src/appreciation/types/affected-users-paginated.type.ts
- AffectedUsersPaginated:

### back/src/appreciation/types/appreciation-detailed-result.type.ts
- AppreciationDetailedResult:
- AppreciationDetails:

### back/src/appreciation/types/appreciation-distribute-details.type.ts
- AppreciationDistributeUserDetails:

### back/src/appreciation/types/appreciation-distribute-group.type.ts
- AppreciationDistributeGroup:

### back/src/appreciation/types/appreciation-distribute-maturity-level-by-dimension.type.ts
- AppreciationDistributeMaturityLevelByDimension:

### back/src/appreciation/types/appreciation-distribute-query-user-log.type.ts
- AppreciationDistributeQueryUserLog:

### back/src/appreciation/types/appreciation-distribute-question-option.type.ts
- AppreciationDistributeQuestionOption:
- SaveAppreciationDistributeQuestionOption:

### back/src/appreciation/types/appreciation-ditribute-question.type.ts
- AppreciationDistributeQuestion:
- SaveAppreciationDistributeQuestion:

### back/src/appreciation/types/appreciation-public-distribute-maturity-level-by-dimension.type.ts
- PublicAppreciationDistributeMaturityLevelByDimension:

### back/src/appreciation/types/appreciation-public-distribute-question.type.ts
- PublicAppreciationDistributeQuestion:
- SavePublicAppreciationDistributeQuestion:

### back/src/appreciation/types/appreciation-public-ditribute-question-option.type.ts
- AppreciationPublicDistributeQuestionOption:
- SaveAppreciationPublicDistributeQuestionOption:

### back/src/appreciation/types/appreciation-user-ranking.type.ts
- UserRanking:

### back/src/appreciation/types/get-appreciation-paginated-resp.type.ts
- IGetAppreciationPaginatedResp:

### back/src/appreciation-distribute/appreciation-distribute-details.schema.ts
- AppreciationDistributeDetails:

### back/src/appreciation-distribute/appreciation-distribute.controller.ts
- AppreciationDistributeController: findAll, findAppreciationDistributeById

### back/src/appreciation-distribute/appreciation-distribute.module.ts
- AppreciationDistributeModule:

### back/src/appreciation-distribute/appreciation-distribute.resolver.ts
- AppreciationDistributeResolver: userAppreciation, userAppreciationByVendor, appreciationDistributeById, startAppreciationDistribute, saveAppreciationDistribute, createOrUpdateAppreciationDetails, changeAppreciationDistributeId, removeAppreciationDistributeByDistributeId, appreciationRanking, appreciationReport, deleteAppreciationDistribute, isAvailable, appreciation, activeQuestionIndex, completedPercent, associatedActionPlans, user, distributedBy, appreciationDistributeDetails, team

### back/src/appreciation-distribute/appreciation-distribute.schema.ts
- AppreciationDistribute:

### back/src/appreciation-distribute/appreciation-distribute.service.ts
- AppreciationDistributeService: findAll

### back/src/appreciation-distribute/dto/appreciation-distribute.dto.ts
- AppreciationDistributeQuestionOptionDto:
- AppreciationDistributeQuestionDto:
- AppreciationDistributeMaturityLevelByDimensionDto:
- AppreciationDistributeDto:

### back/src/appreciation-distribute/inputs/change-appreciation-distribute-id.input.ts
- ChangeAppreciationDistributeInput:

### back/src/appreciation-distribute/inputs/create-or-update-distribute-detail.input.ts
- CreateOrUpdateAppreciationDetailsInput:

### back/src/area/area.controller.ts
- AreaController: findAll, findAllUserCertifications

### back/src/area/area.module.ts
- AreaModule:

### back/src/area/area.resolver.ts
- AreaResolver: areas, createArea, updateArea, deleteArea, users, divisions, roles, leader

### back/src/area/area.schema.ts
- Area:

### back/src/area/area.service.ts
- AreaService: getAreas, getAreaByIdAndVendor, getAreaById, getAreasByIds, createArea, updateArea, deleteArea, getUsersByArea, getDivisionsByArea, getRolesByArea, getLeaderByArea, getLeader

### back/src/area/division.controller.ts
- DivisionController: findAll

### back/src/area/division.resolver.ts
- DivisionResolver: getDivision, getAllDivision, createDivision, updateDivision, deleteDivision, areas, leader

### back/src/area/division.schema.ts
- Division:

### back/src/area/division.service.ts
- DivisionService: get, findAll, create, update, delete

### back/src/area/dto/area-users.dto.ts
- UserCertificationDto:
- UserCertificationResponseDto:

### back/src/area/dto/area.dto.ts
- ResponseAreaDto:

### back/src/area/dto/division.dto.ts
- ResponseDivisionDto:

### back/src/area/inputs/create-area.input.ts
- CreateAreaInput:

### back/src/area/inputs/create-division.input.ts
- CreateDivisionInput:

### back/src/area/inputs/delete-area.input.ts
- DeleteAreaInput:

### back/src/area/inputs/update-area.input.ts
- UpdateAreaInput:

### back/src/area/inputs/update-division.input.ts
- UpdateDivisionInput:

### back/src/auth/auth-payload.type.ts
- AuthPayloadType:

### back/src/auth/auth.module.ts
- AuthModule:

### back/src/auth/auth.resolver.ts
- AuthResolver: login, loginApplicant, loginAdmin, loginWithToken, signup, signupApplicant, refreshAccessToken, reSendEmailConfirmation, validateEmailConfirmation, loginWithFacebook, loginWithGoogle, loginWithLinkedIn, loginWithMicrosoft, loginApplicantWithLinkedIn

### back/src/auth/auth.service.ts
- AuthService: validate, validateApplicant, login, loginWithToken, loginApplicant, signUp, hasUsersAvailable, signUpApplicant

### back/src/auth/dto/refresh-token.dto.ts
- RefreshTokenPayload:

### back/src/auth/gql-auth.guard.ts
- GqlAuthGuard: getRequest
- OptionalGqlAuthGuard: getRequest, handleRequest
- GqlApplicantAuthGuard: getRequest

### back/src/auth/inputs/login-applicant-linkedin.input.ts
- LinkedInExtraDataInput:
- LoginApplicantWithLinkedInInput:

### back/src/auth/inputs/login.input.ts
- LoginInput:

### back/src/auth/inputs/refresh-access-token.input.ts
- RefreshAccessTokenInput:

### back/src/auth/inputs/social-network-login.input.ts
- SocialNetworkLogInInput:

### back/src/auth/inputs/validate-email-confirmation.input.ts
- ValidateEmailConfirmationInput:

### back/src/auth/jwt-payload.type.ts
- JwtPayloadType:

### back/src/auth/jwt.strategy.ts
- JwtStrategy: validate

### back/src/auth/refresh-token.schema.ts
- RefreshToken:

### back/src/azdevops/azdevops.module.ts
- AzdevopsModule:

### back/src/azdevops-timesheets/azdevops-timesheets.module.ts
- AzdevopsTimesheetsModule:

### back/src/azdevops-timesheets/azdevops-timesheets.resolver.ts
- AzdevopsTimesheetsResolver: getWorkItems, createWorkItemTask, createWorkItemTaskBulk, parseTextToTasks

### back/src/azdevops-timesheets/azdevops-timesheets.service.ts
- AzdevopsTimesheetsService: getWorkItems, getWorkItemDetail, createWorkItemTask, createWorkItemTasksBulk

### back/src/azdevops-timesheets/inputs/create-workitem-task-bulk.input.ts
- CreateWorkItemTaskBulkInput:

### back/src/azdevops-timesheets/inputs/create-workitem-task.input.ts
- CreateWorkItemTaskInput:

### back/src/azdevops-timesheets/inputs/parse-text-to-tasks.input.ts
- ParseTextToTasksInput:

### back/src/azdevops-timesheets/inputs/work-item-task.input.ts
- WorkItemTaskInput:

### back/src/azdevops-timesheets/types/workitem-element.types.ts
- WorkItem:

### back/src/benefit-requests/benefit-requests.module.ts
- BenefitRequestsModule:

### back/src/benefit-requests/benefit-requests.resolver.ts
- BenefitRequestsResolver: myRequestsPaginated, findAll, findPaginated, createBenefitRequest, approveBenefitRequest, rejectBenefitRequest, deleteBenefitRequest, benefit, requestedBy, approveBy

### back/src/benefit-requests/benefit-requests.service.ts
- BenefitRequestsService: create, findMyRequests, findMyRequestsPaginated, findOne, approve, reject, findPaginated, delete, findAll

### back/src/benefit-requests/dto/create-benefit-request.input.ts
- CreateBenefitRequestInput:

### back/src/benefit-requests/dto/decide-benefit-request.input.ts
- DecideBenefitRequestInput:

### back/src/benefit-requests/inputs/get-benefit-request-pagination.input.ts
- GetBenefitRequestPaginationInput:

### back/src/benefit-requests/schemas/benefit-request.schema.ts
- BenefitRequest:

### back/src/benefit-requests/types/benefit-request-paginated.type.ts
- BenefitRequestPaginated:

### back/src/benefits/benefits.module.ts
- BenefitsModule:

### back/src/benefits/benefits.resolver.ts
- BenefitsResolver: findAll, findOne, findPaginated, createBenefit, updateBenefit, deleteBenefit, requestCount

### back/src/benefits/benefits.service.ts
- BenefitsService: create, findAll, findOne, update, delete, validateBenefitForRequest, findPaginated, countBenefitRequests

### back/src/benefits/dto/create-benefit.input.ts
- CreateBenefitInput:

### back/src/benefits/dto/update-benefit.input.ts
- UpdateBenefitInput:

### back/src/benefits/inputs/get-benefit-pagination.input.ts
- GetBenefitPaginationInput:

### back/src/benefits/schemas/benefit.schema.ts
- Benefit:

### back/src/benefits/types/benefit-paginated.type.ts
- BenefitPaginated:

### back/src/buy-sell/buy-sell-item.schema.ts
- BuySellItem:

### back/src/buy-sell/buy-sell.module.ts
- BuySellModule:

### back/src/buy-sell/buy-sell.resolver.ts
- BuySellResolver: getBuySellItemsPaginated, getBuySellItem, createBuySellItem, updateBuySellItem, deleteBuySellItem, markBuySellItemAsSold, sellerId, canManage, seller

### back/src/buy-sell/buy-sell.service.ts
- BuySellService: getItemsPaginated, getItem, createItem, updateItem, deleteItem, markAsSold, getSeller, getMutableItem

### back/src/buy-sell/inputs/create-buy-sell-item.input.ts
- CreateBuySellItemInput:

### back/src/buy-sell/inputs/get-buy-sell-items-paginated.input.ts
- GetBuySellItemsPaginatedInput:

### back/src/buy-sell/inputs/update-buy-sell-item.input.ts
- UpdateBuySellItemInput:

### back/src/buy-sell/types/get-buy-sell-items-paginated-resp.ts
- GetBuySellItemsPaginatedResp:

### back/src/career/career.module.ts
- CareerModule:

### back/src/career/career.resolver.ts
- CareerResolver: careers, career, createCareer, updateCareer, deleteCareer, roles, createdBy

### back/src/career/career.schema.ts
- Career:

### back/src/career/career.service.ts
- CareerService: createCareer, updateCareer, getCareer, getAllCareers, deleteCareer, getCreatedBy

### back/src/career/hierarchy.resolver.ts
- HierarchyResolver: getHierarchiesByCareer, itemPath, childrens

### back/src/career/inputs/asign-career-to-user.input.ts
- AssignCareerToUserInput:

### back/src/career/inputs/create-career.input.ts
- CreateCareerInput:

### back/src/career/inputs/create-item-path-question-option.input.ts
- CreateItemPathQuestionOptionInput:

### back/src/career/inputs/create-item-path-question.input.ts
- CreateItemPathQuestionInput:
- CreateItemPathQuestionInputOption:

### back/src/career/inputs/create-item-path.input.ts
- ItemPathMaturityInput:
- CreateItemPathInput:

### back/src/career/inputs/delete-career.input.ts
- DeleteCareerInput:

### back/src/career/inputs/delete-item-path-question.input.ts
- DeleteItemPathQuestionInput:

### back/src/career/inputs/delete-item.path.input.ts
- DeleteItemPathInput:

### back/src/career/inputs/delete-user-career.input.ts
- DeleteUserCareerInput:

### back/src/career/inputs/get-all-career.input.ts
- GetAllCareerInput:

### back/src/career/inputs/get-all-hierarchies.input.ts
- GetAllHierarchiesInput:

### back/src/career/inputs/get-all-item-path.input.ts
- GetAllItemPathInput:

### back/src/career/inputs/get-all-user-career.input.ts
- GetAllUserCareerInput:

### back/src/career/inputs/get-all-user-hierarchies.input.ts
- GetAllUserHierarchiesInput:

### back/src/career/inputs/get-career.input.ts
- GetCareerInput:

### back/src/career/inputs/get-item-path.input.ts
- GetItemPathInput:

### back/src/career/inputs/get-user-active-career.input.ts
- GetUserActiveCareerInput:

### back/src/career/inputs/get-user-career.input.ts
- GetUserCareerInput:

### back/src/career/inputs/get-user-item-path-test.input.ts
- GetUserItemPathTestInput:

### back/src/career/inputs/get-user-item-path.input.ts
- GetUserItemPathInput:

### back/src/career/inputs/get-user-item-paths.input.ts
- GetUserItemPathsInput:

### back/src/career/inputs/update-career.input.ts
- UpdateCareerInput:

### back/src/career/inputs/update-item-path-question.input.ts
- UpdateItemPathQuestionInput:
- UpdateItemPathQuestionInputOption:

### back/src/career/inputs/update-item-path.input.ts
- UpdateItemPathInput:

### back/src/career/inputs/validate-user-item-path-test.input.ts
- ValidateUserItemPathTestInput:

### back/src/career/item-path-question-option.resolver.ts
- ItemPathQuestionOptionResolver: createItemPathQuestionOption, itemPathQuestionOptions

### back/src/career/item-path-question-option.schema.ts
- ItemPathQuestionOption:

### back/src/career/item-path-question.resolver.ts
- ItemPathQuestionResolver: createItemPathQuestion, updateItemPathQuestion, deleteItemPathQuestion, itemPathQuestions, options

### back/src/career/item-path-question.schema.ts
- ItemPathQuestion:

### back/src/career/item-path.resolver.ts
- ItemPathResolver: itemPaths, itemPathsPaginated, itemPath, createItemPath, updateItemPath, deleteItemPath, multimedias, maturity, dimensions, associatedCareers, itemPathQuestions, createdBy

### back/src/career/item-path.schema.ts
- ItemPath:

### back/src/career/types/career-version.type.ts
- CareerVersion:

### back/src/career/types/hierarchy.type.ts
- Hierarchy:

### back/src/career/types/item-path-list-paginated.type.ts
- ItemPathListPaginated:

### back/src/career/types/item-path-maturities.type.ts
- ItemPathMaturity:

### back/src/career/types/item-path-paginated.type.ts
- ItemPathPaginated:

### back/src/career/types/user-hierarchy.type.ts
- UserHierarchy:

### back/src/career/types/user-item-path-question-log.type.ts
- UserItemPathQuestionLog:

### back/src/career/types/user-item-path-question-option.type.ts
- UserItemPathQuestionOption:

### back/src/career/types/user-item-path-question.type.ts
- UserItemPathQuestion:

### back/src/career/types/user-multimedia.type.ts
- UserMultimedia:

### back/src/career/types/validate-user-item-path.type.ts
- ValidateUserItemPath:

### back/src/career/user-career.resolver.ts
- UserCareerResolver: getAllUserCareer, userCareer, userActiveCareer, assignCareer, deleteUserCareer, roles, completionPercentage

### back/src/career/user-career.schema.ts
- UserCareer:

### back/src/career/user-career.service.ts
- UserCareerService: assignCareerToUser, removeAssignedCareerToUser, getUserCareer, getUserActiveCareer, getAllUserCareer, getUserItemPathByIds, calculateUserHierarchyChildrens, getCompletionPercentage, getUserItemPaths

### back/src/career/user-hierarchy.resolver.ts
- UserHierarchyResolver: getUserHierarchiesByCareer, userItemPath, childrens

### back/src/career/user-item-path.resolver.ts
- UserItemPathResolver: userItemPaths, userItemPath, userItemPathTest, validateUserItemPathTest, multimedias, maturity, dimensions, mustBeHere, isAvailable, enableTest

### back/src/career/user-item-path.schema.ts
- UserItemPath:

### back/src/challenge/challenge.controler.ts
- ChallengeController: challengeStart, calculateRanking, finishRanking

### back/src/challenge/challengue.module.ts
- ChallengeModule:

### back/src/challenge/challengue.resolver.ts
- ChallengeResolver: questionsIndex, userAvailableChallenges, challenges, publicChallenges, vendorChallenges, createChallenge, userStartChallenge, updateChallenge, startVendorChallenge, cancelStartedChallenge, tags, dimension, isRunning

### back/src/challenge/challengue.schema.ts
- Challenge:

### back/src/challenge/challengue.service.ts
- ChallengeService: getChallengeById, getStartedChallenges, getParticipants, getChallengeDimension, createChallenge, updateChallenge, getPublicChallenges, getVendorChallenges, getChallenges, startVendorChallenge, checkIsRunning, getRunningChallenges, getUserAvailableChallenges, userStartChallenge, getQuestionsIndex, calculateRanking

### back/src/challenge/dto/challenge.dto.ts
- ChallengeDto:

### back/src/challenge/inputs/cancel-started-challenge.input.ts
- CancelStartedChallengeInput:

### back/src/challenge/inputs/create-challenge.input.ts
- CreateChallengeInput:

### back/src/challenge/inputs/get-challenges.input.ts
- GetChallengesInput:

### back/src/challenge/inputs/get-running-challenges.input.ts
- GetRunningChallengesInput:

### back/src/challenge/inputs/get-started-challenge-ranking.input.ts
- GetStartedChallengeRankingInput:

### back/src/challenge/inputs/start-vendor-challenge.input.ts
- StartVendorChallengeInput:

### back/src/challenge/inputs/update-challenge.input.ts
- UpdateChallengeInput:

### back/src/challenge/inputs/update-start-challenge.input.ts
- UserStartChallengeInput:

### back/src/challenge/started-challenge-data.schema.ts
- StartedChallengeData:

### back/src/challenge/started-challenge.resolver.ts
- StartedChallengeResolver: runningChallenges, startedChallengeRanking, challenge, participants

### back/src/challenge/started-challenge.schema.ts
- StartedChallenge:

### back/src/challenge/types/challenge-ranking-info.types.ts
- ChallengeRankingInfo:

### back/src/challenge/types/challenge-ranking.types.ts
- ChallengeRanking:

### back/src/challenge/vendor-challenge.schema.ts
- VendorChallenge:

### back/src/coin/coin-category.schema.ts
- CoinCategorie:

### back/src/coin/coin-transaction-request.resolver.ts
- CoinTransactionRequestResolver: coinTransactionRequest, coinTransactionHistoryByUser, createCoinTransactionRequest, updateCoinTransactionRequest, products, user

### back/src/coin/coin-transaction-request.schema.ts
- CoinTransactionRequest:

### back/src/coin/coin.controller.ts
- CoinController: getCoinsStats

### back/src/coin/coin.module.ts
- CoinModule:

### back/src/coin/coin.resolver.ts
- CoinResolver: coinCategories, coinCategorie, userCoinTransaction, topUsers, createCoinCategorie, updateCoinCategorie, toggleDefaultCoinCategorie, deleteCoinCategory, createCoin, coinCategory, createdBy

### back/src/coin/coin.schema.ts
- Coin:

### back/src/coin/coin.service.ts
- CoinService: getCoinsLog, getCurrentCoins, getCoinCategoryById, getCoinCategories, getCoinTransactionRequest, getUserCoinTransaction, createCoinCategorie, updateCoinCategorie, toggleCoinCategorie, deleteCoinCategorie, createCoin, createCoinTransactionRequest

### back/src/coin/dto/user-coin-transaction.dto.ts
- UserCoins:

### back/src/coin/dto/user-coins-stats-response.dto.ts
- UserCoinsStatsResponseDto:

### back/src/coin/dto/user-coins-transactions-history.dto.ts
- UserCoinsTransactionsHistory:

### back/src/coin/inputs/create-coin-categorie.input.ts
- CreateCoinCategorieInput:

### back/src/coin/inputs/create-coin-transaction-request.input.ts
- SimplifiedMemoryItem:
- CreateCoinTransactionRequestInput:

### back/src/coin/inputs/create-coin.input.ts
- CreateCoinInput:

### back/src/coin/inputs/get-coin-categorie.input.ts
- GetCoinCategorieInput:

### back/src/coin/inputs/update-coin-categorie.input.ts
- UpdateCoinCategorieInput:

### back/src/coin/inputs/update-coin-transaction-request.input.ts
- UpdateCoinTransactionRequestInput:

### back/src/common/common.controller.ts
- CommonController: sendEmail

### back/src/common/common.module.ts
- CommonModule:

### back/src/common/common.service.ts
- CommonService: sendEmail, getSignedUrl, getSignedUrlForMediaStorage, getSignedUrlForMediaStorageRead, upload, sendSms, scheduleTask, getNextSequence, createSquence, makeId, validateRecaptcha, generateSlug, getExtensionFromBase64, createSubdomain, capitalizeFirstLetter, createExportRoutine, getUserExports, getUserExportPaginated

### back/src/common/counter.schema.ts
- Counter:

### back/src/common/dto/send-email-request.dto.ts
- SendEmailRequestDto:

### back/src/common/dto/send-email-response.dto.ts
- SendEmailResponseDto:

### back/src/common/export.resolver.ts
- ExportResolver: exports, myDownloads, export, createExport

### back/src/common/export.schema.ts
- Export:

### back/src/common/guards/api-key.guard.ts
- ApiKeyGuard: canActivate

### back/src/common/guards/origin-validation.guard.ts
- OriginValidationGuard: canActivate

### back/src/common/inputs/files-paginated.input.ts
- FilesPaginatedInput:

### back/src/common/types/files-paginated.type.ts
- FilesPaginated:

### back/src/conversation/conversation-message.resolver.ts
- ConversationMessageResolver: sender, createdAt, updatedAt, conversation

### back/src/conversation/conversation-message.schema.ts
- ConversationMessage:

### back/src/conversation/conversation-subscription.resolver.ts
- ConversationSubscriptionResolver: conversationMessageSent, userTyping

### back/src/conversation/conversation.module.ts
- ConversationModule:

### back/src/conversation/conversation.resolver.ts
- ConversationResolver: conversations, conversationMessages, createConversation, sendConversationMessage, setTypingStatus, createGroupConversation, addParticipantsToGroup, removeParticipantFromGroup, updateGroupInfo, leaveGroup, markConversationAsRead, chatPresenceHeartbeat, participants, lastMessage, createdBy, admins, unreadCount, createdAt, updatedAt

### back/src/conversation/conversation.schema.ts
- Conversation:

### back/src/conversation/conversation.service.ts
- ConversationService: getConversation, getConversations, getConversationMessages, createConversation, sendMessage, getMessage, markConversationAsRead, getUnreadCount, createGroupConversation, addParticipantsToGroup, removeParticipantFromGroup, updateGroupInfo, leaveGroup, createSystemMessage

### back/src/conversation/dto/conversation.input.ts
- CreateConversationInput:
- CreateGroupConversationInput:
- AddParticipantsInput:
- RemoveParticipantInput:
- UpdateGroupInfoInput:
- SendMessageInput:

### back/src/conversation/dto/typing-status.dto.ts
- TypingStatusInput:
- TypingEvent:

### back/src/conversation/presence.service.ts
- PresenceService: key, getRedis, getRedisClient, setOnline, setOffline, isOnline, filterOnline

### back/src/corporate-values/corporate-value.module.ts
- CorporateValueModule:

### back/src/corporate-values/corporate-values.resolver.ts
- CorporateValuesResolver: getCorporateValuesByVendor, createCorporateValue, updateCorporateValue, deleteCorporateValue, corporateValueRanking, corporateValueRankingByVendor, corporateValueReport, timesSent

### back/src/corporate-values/corporate-values.schema.ts
- CorporateValue:

### back/src/corporate-values/corporate-values.service.ts
- CorporateValuesService: saveCorporateValue, getCorporateValuesByVendor, updateCorporateValue, deleteCorporateValue, corporateValueRankingByVendor, corporateValueReport

### back/src/corporate-values/inputs/create-corporate-value.input.ts
- CreateCorporateValueInput:

### back/src/corporate-values/inputs/update-corporate-value.input.ts
- UpdateCorporateValueInput:

### back/src/corporate-values/types/general-ranking-corporate-value.type.ts
- GeneralRankingCorporateValue:

### back/src/corporate-values/types/ranking-corporate-value.type.ts
- RankingUserCorporateValue:

### back/src/course/course-distribute.resolver.ts
- CourseDistributeResolver: courseDistributeByAppreciationDistributeId, coursesDistribute, courseDistributeById, finishedCourseMultimediaDistribute, coursesDistributeByUserId, addCourseMultimediaDistributeToUser, course, name, multimediaDistribute

### back/src/course/course-distribute.schema.ts
- CourseDistribute:

### back/src/course/course-multimedia-distribute.schema.ts
- CourseMultimediaDistribute:

### back/src/course/course.module.ts
- CourseModule:

### back/src/course/course.resolver.ts
- CourseResolver: createCourse, courseById, courses, updateCourse, deleteCourse, vendor, tags, maturities, dimensions, multimedia

### back/src/course/course.schema.ts
- Course:

### back/src/course/course.service.ts
- CourseService: createCourse, getCourseById, getCourses, updateCourse, deleteCourse, getCourseDistributeByAppreciationDistributeId, getAllCoursesDistributeByUserId, getCourseDistributeByIdAndUser, getCourseMultimediaDistributeById, getRandomInt, getCourseMultimediaDistributesByIds, updateReviewedCourseMultimediaDistributeById, finishedCourseMultimediaDistributeById, addMultimediaToCourseDistribute

### back/src/course/inputs/add-course-multimedia-distribute.input.ts
- AddCourseMultimediaDistributeInput:

### back/src/course/inputs/create-course.input.ts
- CreateCourseInput:

### back/src/course/inputs/get-courses.input.ts
- GetCoursesInput:

### back/src/course/inputs/update-course.input.ts
- UpdateCourseInput:

### back/src/customization/decorators/auth.decorator.ts
- Auth

### back/src/customization/decorators/custom-permissions.ts
- CustomPermissions

### back/src/customization/decorators/decorators.ts
- ResGql
- GqlUser
- GqlApplicantUser
- GqlUserId
- VendorHostname

### back/src/customization/decorators/guards/custom-permissions.guard.ts
- CustomPermissionsGuard: canActivate

### back/src/customization/decorators/guards/user-role.guard.ts
- UserRoleGuard: canActivate

### back/src/customization/decorators/role-protected.decorator.ts
- RoleProtected

### back/src/customization/schemas/base.schema.ts
- Base:

### back/src/cv-history/cv-history.module.ts
- CvHistoryModule:

### back/src/cv-history/cv-history.resolver.ts
- CvHistoryResolver: createCvHistory, getPaginatedCvHistory, deleteCvHistory, cloneCvHistory, getCvHistoryById, getPublicCvHistoryById, updateCvVersion, downloadCvVersion, contactCandidate, user, offers, industries, createdBy

### back/src/cv-history/cv-history.schema.ts
- CvHistory:

### back/src/cv-history/cv-history.service.ts
- CvHistoryService: create, getPaginated, delete, clone, getCvHistoryById, updateCvVersion, getOffers, getIndustries, getUserById, downloadCv

### back/src/cv-history/inputs/create-cv-history.input.ts
- CreateCvHistoryInput:

### back/src/cv-history/inputs/cvhistory-paginated.input.ts
- CvHistoryPaginatedInput:

### back/src/cv-history/inputs/update-cv-history-version.input.ts
- UpdateCvHistoryVersionInput:

### back/src/cv-history/inputs/update-cv-history.input.ts
- UpdateCvHistoryInput:

### back/src/cv-history/types/cvhistoy-paginated.type.ts
- CvHistoryPaginated:

### back/src/cv-history/types/cvinfo.type.ts
- CvInfo:

### back/src/dashboard/dashboard-data.schema.ts
- DashboardData:

### back/src/dashboard/dashboard.module.ts
- DashboardModule:

### back/src/dashboard/dashboard.resolver.ts
- DashboardResolver: dashboardData, organizationalDashboardData, organizationalRanking, teamPerformance

### back/src/dashboard/dashboard.service.ts
- DashboardService: getDashboardDataResults

### back/src/dashboard/inputs/get-dashboard-data.input.ts
- GetDashboardDataInput:

### back/src/dashboard/inputs/team-performance.input.ts
- GetTeamPerformanceInput:

### back/src/dashboard/types/career-path-acomplishment-data.type.ts
- CareerPathAcomplishmentData:

### back/src/dashboard/types/career-path-acomplishment-per-month.type.ts
- CareerPathAcomplishmentDataPerMonthItem:
- CareerPathAcomplishmentDataPerMonth:

### back/src/dashboard/types/completed-task-per-month.type.ts
- CompletedTaskPerMonth:

### back/src/dashboard/types/dashboard-results.type.ts
- DashboardResult:

### back/src/dashboard/types/last-appreciation-data.type.ts
- LastAppreciationData:

### back/src/dashboard/types/organizational-dashboard-result.type.ts
- OrganizationalDashboardResult:

### back/src/dashboard/types/organizational-ranking-result.type.ts
- OrganizationalRanking:
- RankingTeam:
- RankingUser:
- TeamLeader:

### back/src/dashboard/types/team-performance.type.ts
- TeamPerformance:

### back/src/dimension/dimension.module.ts
- DimensionModule:

### back/src/dimension/dimension.resolver.ts
- DimensionResolver: dimension, dimensions, getDimensionPublic, dimensionsPaginated, createDimension, updateDimension, deleteDimension, roles, tags, associatedRoles

### back/src/dimension/dimension.schema.ts
- Dimension:

### back/src/dimension/dimension.service.ts
- DimensionService: createDimension, getDimension, getDimensions, getDimensionsPaginated, updateDimension, deleteDimension, getDimensionByIds, getDimensionById, getDimensionByIdOrName, getDimensionByName

### back/src/dimension/inputs/create-dimension.input.ts
- CreateDimensionInput:

### back/src/dimension/inputs/dimension.input.ts
- DimensionInput:

### back/src/dimension/inputs/get-dimensions-paginated.input.ts
- GetDimensionsPaginatedInput:

### back/src/dimension/inputs/get-dimensions.input.ts
- GetDimensionsInput:

### back/src/dimension/inputs/update-dimension.input.ts
- UpdateDimensionInput:

### back/src/dimension/types/dimensions-paginated.type.ts
- DimensionsPaginated:

### back/src/endorsement/endorsement.module.ts
- EndorsementModule:

### back/src/endorsement/endorsement.resolver.ts
- EndorsementResolver: userEndorsements, endorsements, addNewEndorsement, updateEndorsement, deleteEndorsement, skill, endorserUser, skilledUser

### back/src/endorsement/endorsement.schema.ts
- Endorsement:

### back/src/endorsement/endorsement.service.ts
- EndorsementService: createEndorsement, deleteEndorsement, updateComment, getEndorsementUser, getSkilledUser, getUserEndorsementResults, getUserEndorsements, validateUsers

### back/src/endorsement/inputs/create-endorsement.input.ts
- CreateEndorsementInput:

### back/src/endorsement/inputs/delete-endorsement.input.ts
- DeleteEndorsementInput:

### back/src/endorsement/inputs/get-endorsement.input.ts
- GetEndorsementInput:

### back/src/endorsement/inputs/get-user-endorsement-result.input.ts
- GetUserEndorsementResultsInput:

### back/src/endorsement/inputs/update-comment.input.ts
- UpdateCommentInput:

### back/src/endorsement/types/user-endorsement-result.type.ts
- UserEndorsementResult:

### back/src/feedback/feedback.module.ts
- FeedbackModule:

### back/src/feedback/feedback.resolver.ts
- FeedbackResolver: feedback, feedbacks, createFeedback, user, vendor

### back/src/feedback/feedback.schema.ts
- Feedback:

### back/src/feedback/feedback.service.ts
- FeedbackService: createFeedBack, getFeedback, getFeedbacks, deleteFeedback, getVendor

### back/src/feedback/input/create-feedback.input.ts
- CreateFeedbackInput:

### back/src/form/dto/clone-form.dto.ts
- CloneFormInputDto:

### back/src/form/dto/create-form-question.dto.ts
- CreateFormQuestionDto:

### back/src/form/dto/create-form.dto.ts
- CreateFormInputDto:

### back/src/form/dto/edit-form-question.dto.ts
- EditFormQuestionDto:

### back/src/form/dto/form-sentiment-analysis.dto.ts
- FormSentimentAnalysisDto:

### back/src/form/dto/form-totalized-response.dto.ts
- FormTotalizedReponse:

### back/src/form/dto/form.dto.ts
- FormDto:

### back/src/form/form-question-option-likert.schema.ts
- FormQuestionOptionLikert:

### back/src/form/form-question-option.schema.ts
- FormQuestionOption:

### back/src/form/form-question.resolver.ts
- FormQuestionResolver: formQuestion, createFormQuestion, updateFormQuestion, deleteFormQuestion, formQuestionOptions, formQuestionLikertScaleOptions, createFormQuestionWithAI

### back/src/form/form-question.schema.ts
- FormQuestion:

### back/src/form/form.controller.ts
- FormController: createForm, cloneForm, getForm, deleteForm, getFormResponses, editFormQuestion

### back/src/form/form.module.ts
- FormModule:

### back/src/form/form.resolver.ts
- FormResolver: form, canAnswerForm, forms, formsPaginated, formTemplatesPaginated, createForm, createFormWithAi, updateForm, deleteForm, markAsFinished, toggleForm, cloneForm, friendlySurveyReminder, questions, createdBy, isFormShared, isAnswered

### back/src/form/form.schema.ts
- Form:

### back/src/form/form.service.ts
- FormService: getForms, getFormsPaginated, getFormTemplatesPaginated, getUsersFiltered, getFormById, getUserById, getSharedUsers, getFormQuestionById, getFormQuestionsByFormId, handleQuestions, createForm, editForm, deleteForm, toggleForm, throwIfTemplate, markAsFinished

### back/src/form/inputs/create-form-ai.input.ts
- CreateFormWithAIInput:

### back/src/form/inputs/create-form-question-ai-input.ts
- CreateFormQuestionWithAIInput:

### back/src/form/inputs/create-form-question.input.ts
- CreateFormQuestionInput:

### back/src/form/inputs/create-form.input.ts
- CreateFormInput:

### back/src/form/inputs/delete-form.input.ts
- DeleteFormInput:

### back/src/form/inputs/edit-form-question.input.ts
- EditFormQuestionInput:

### back/src/form/inputs/edit-form.input.ts
- EditFormInput:

### back/src/form/inputs/get-form-paginated.input.ts
- GetFormsPaginatedInput:

### back/src/form/types/details.type.ts
- DetailsQuestion:

### back/src/form/types/get-form.type.ts
- GetForm:

### back/src/form/types/question-option.ts
- CreateFormQuestionOption:

### back/src/form/types/question.type.ts
- CreateFormQuestion:

### back/src/form-response/args/form-args.ts
- FormArgs:

### back/src/form-response/args/form-response.args.ts
- FormResponseArgs:

### back/src/form-response/dto/form-csv.dto.ts
- FormCsvDto:

### back/src/form-response/dto/form-response-csv.dto.ts
- FormResponseCsv:

### back/src/form-response/form-answer.resolver.ts
- FormAnswerResolver: answerOptions

### back/src/form-response/form-answer.schema.ts
- FormAnswer:

### back/src/form-response/form-response.controller.ts
- FormResponseController: getFormResponseByFormId, getCsvFormResponse

### back/src/form-response/form-response.module.ts
- FormResponseModule:

### back/src/form-response/form-response.resolver.ts
- FormResponseResolver: formResponseById, resolveFormResponseForAnswer, getFormResponsePagination, formResponseByUser, createFormResponse, getFormShareLink, openFormFromShareLink, updateFormResponse, userMarkPerformanceEvaluationAsFinished, getFormResponseByFormId, getFormReponseIdByFormAndResponseId, getCsvFormResponse, getLeaderSelected, getLeaderShipEvaluations, getSelfEvaluation, myLeaderEvaluations, getHistoricSelfEvaluations, getMyLeaderShipEvaluations, updateLeaderShipEvaluationByLeader, answers, form, user, sharedUsers, userEvaluated, performanceEvaluation, performanceEvaluationName, punctuation

### back/src/form-response/form-response.schema.ts
- FormResponse:

### back/src/form-response/form-response.service.ts
- FormResponseService: getFormResponseById, resolveFormResponseForAnswer, getFormResponseUserId, emailsMatch, tryClaimEmailFormResponse, canAccessFormResponse, assertFormResponseAccess, openFormFromShareLink, createFormShareLink, getFormResponsePagination, getFormResponseByUser, createFormResponse, updateFormResponse

### back/src/form-response/inputs/create-form-answer.input.ts
- CreateFormAnswerInput:

### back/src/form-response/inputs/create-form-response.input.ts
- CreateFormResponseInput:

### back/src/form-response/inputs/update-form-response.input.ts
- UpdateFormResponseInput:

### back/src/form-response/inputs/update-performance-evaluation-answers.input.ts
- UpdatePerformanceEvaluationAnswersInput:
- QuestionInput:
- PerformanceEvaluationAnswers:
- AnswerInput:
- FormQuestionOptionInput:
- LikertSummaryInput:
- FormQuestionLikertScaleOptionInput:

### back/src/form-response/types/form-answer-create.type.ts
- FormAnswerCreate:

### back/src/form-response/types/form-answer-likert.type.ts
- FormAnswerLikert:

### back/src/form-response/types/form-punctuation-details.type.ts
- FormPunctuationDetails:

### back/src/form-response/types/get-form-format-csv.type.ts
- GetFormResponseFormatCsv:
- FormatUserCsv:
- FormatDataCsv:
- FormAnswerLikertOptionsResponse:

### back/src/form-response/types/get-form-response-grouped.type.ts
- GetFormAnswer:
- OptionGrouped:
- LikertUserAnswer:
- QuestionGrouped:
- GetFormResponseGrouped:
- LikertAnwserGrouped:
- ResponseLikerGrouped:

### back/src/form-response/types/get-form-response.type.ts
- GetFormResponse:

### back/src/form-response/types/leader-selected.type.ts
- LeaderSelected:

### back/src/form-send/form-answer-url.helper.ts
- buildFormAnswerUrl

### back/src/form-send/form-send.controller.ts
- FormSendController: createFormSendByUsers, createFormSendByEmails

### back/src/form-send/form-send.module.ts
- FormSendModule:

### back/src/form-send/form-send.resolver.ts
- FormSendResolver: createFormSend, sendByArea, sendFormByDivision, sendFormToAll, sendFormByTeams

### back/src/form-send/form-send.service.ts
- FormSendService: distributeForm, sendByVendor, sendByDivision, sendByArea, sendByTeams, sendByUsers, sendByEmails, sendEmails, templateEmail

### back/src/form-send/inputs/create-form-send-all.input.ts
- CreateFormSendAllInput:

### back/src/form-send/inputs/create-form-send-by-area.input.ts
- CreateFormSendByAreaInput:

### back/src/form-send/inputs/create-form-send-by-division.input.ts
- CreateFormSendByDivisionInput:

### back/src/form-send/inputs/create-form-send-emails.input.ts
- CreateFormSendEmailsInput:

### back/src/form-send/inputs/create-form-send-teams.input.ts
- CreateFormSendByTeamsInput:

### back/src/form-send/inputs/create-form-send-users.input.ts
- CreateFormSendUsersInput:

### back/src/form-send/inputs/create-form-send.input.ts
- CreateFormSendInput:

### back/src/form-send/types/get-form-send.type.ts
- GetFormSend:

### back/src/form-send/types/user-form-send.type.ts
- UserFormSend:

### back/src/goal/goal.module.ts
- GoalModule:

### back/src/goal/goal.resolver.ts
- GoalResolver: goal, goals, archivedGoals, createGoal, updateGoal, deleteGoal, updateTaskPriority, tasks, completionPercentage

### back/src/goal/goal.schema.ts
- Goal:

### back/src/goal/goal.service.ts
- GoalService: getGoal, getGoals, getArchivedGoals, createGoal, updateGoal, deleteGoal, getTask, getTasks, getTaskByGoalId, getActiveGoalByUserId, createTask, updateTask, deleteTask, getTaskData

### back/src/goal/inputs/create-goal.input.ts
- CreateGoalInput:

### back/src/goal/inputs/create-task.input.ts
- CreateTaskInput:

### back/src/goal/inputs/delete-goal.input.ts
- DeleteGoalInput:

### back/src/goal/inputs/delete-task.input.ts
- DeleteTaskInput:

### back/src/goal/inputs/get-goal.input.ts
- GetGoalInput:

### back/src/goal/inputs/get-task-data.input.ts
- GetTaskDataInput:

### back/src/goal/inputs/get-task.input.ts
- GetTaskInput:

### back/src/goal/inputs/get-tasks.input.ts
- GetTasksInput:

### back/src/goal/inputs/update-goal.input.ts
- UpdateGoalInput:

### back/src/goal/inputs/update-task-priority.input.ts
- UpdateTaskPriorityInput:
- UpdateTaskPriorityItemInput:

### back/src/goal/inputs/update-task.input.ts
- UpdateTaskInput:

### back/src/goal/task.resolver.ts
- TaskResolver: task, tasks, taskData, createTask, updateTask, deleteTask, completedPercent, refIds

### back/src/goal/task.schema.ts
- Task:

### back/src/goal/types/goal-report-response.type..ts
- GoalReportResponse:

### back/src/goal/types/ref-id.type.ts
- RefId:

### back/src/goal/types/task-data.type.ts
- TaskData:

### back/src/helpers/sorts.ts
- sortByHighestNumber
- sortByLowestNumber

### back/src/industry/industry.module.ts
- IndustryModule:

### back/src/industry/industry.resolver.ts
- IndustryResolver: createIndustry, getIndustryById, getIndustryPaginated, deleteIndustry, updateIndustry, getAllIndustries

### back/src/industry/industry.schema.ts
- Industry:

### back/src/industry/industry.service.ts
- IndustryService: createIndustry, getIndustryById, getIndustryPaginated, deleteIndustry, updateIndustry, getAllIndustries

### back/src/industry/inputs/create-industry.input.ts
- CreateIndustryInput:

### back/src/industry/inputs/get-industry-paginated.input.ts
- GetIndustryPaginatedInput:

### back/src/industry/types/get-industries-paginated.type.ts
- IndustriesPaginated:

### back/src/industry/types/industries-by-user.ts
- IndustriesByUser:

### back/src/jobyfine/applicants/applicant.resolver.ts
- ApplicantsResolver: getApplicantsPagination, getApplicantById, getApplicantByEmail, getApplicantByTransformedToUserId, getUserExtraAttributesByApplicantId, createApplicant, deleteApplicant, updateApplicant, provisoryPassword, generateAICV, transformApplicantIntoUser, downloadCv, downloadOfferLetter, uploadCv, updateApplicantFromPortal, getApplicant, tags, processes, createdBy

### back/src/jobyfine/applicants/applicants.module.ts
- ApplicantsModule:

### back/src/jobyfine/applicants/applicants.schema.ts
- Applicants:

### back/src/jobyfine/applicants/applicants.service.ts
- ApplicantsService: createApplicant, updateApplicantFromPortal

### back/src/jobyfine/applicants/inputs/create-applicant.input.ts
- CreateApplicantInput:

### back/src/jobyfine/applicants/inputs/create-user-from-applicant.input.ts
- ChildInput:
- CreateUserFromApplicantInput:

### back/src/jobyfine/applicants/inputs/get-applicant-by-transformed-to-user-id.input.ts
- GetApplicantByTransformedToUserIdInput:

### back/src/jobyfine/applicants/inputs/get-applicants.input.ts
- GetApplicantsInput:

### back/src/jobyfine/applicants/inputs/update-applicant.input.ts
- UpdateApplicantInput:

### back/src/jobyfine/applicants/inputs/upload-cv.input.ts
- UploadCvInput:

### back/src/jobyfine/applicants/types/ai-cv.type.ts
- WorkExperience:
- Education:
- Language:
- ApplicantLinks:
- Certification:
- Industries:
- ExtractionConfidence:
- AICV:

### back/src/jobyfine/applicants/types/created-user.type.ts
- CreatedUser:

### back/src/jobyfine/applicants/types/email-history.type.ts
- EmailHistory:

### back/src/jobyfine/applicants/types/get-applicants-response.type.ts
- GetApplicantsResponse:
<!-- /iaterminal:auto -->

<!-- iaterminal:notes -->
(no annotations yet)
<!-- /iaterminal:notes -->
