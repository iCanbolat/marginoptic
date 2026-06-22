import { Module } from "@nestjs/common";
import { InvitationsService } from "./invitations.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, InvitationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
