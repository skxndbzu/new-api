package model

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id                   int            `json:"id"`
	UserId               int            `json:"user_id"`
	Key                  string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status               int            `json:"status" gorm:"default:1"`
	Name                 string         `json:"name" gorm:"index"`
	Quota                int            `json:"quota" gorm:"default:100"`
	CreatedTime          int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime         int64          `json:"redeemed_time" gorm:"bigint"`
	Count                int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId           int            `json:"used_user_id"`
	InviterRewardUserId  int            `json:"inviter_reward_user_id"`
	InviterRewardRateBps int            `json:"inviter_reward_rate_bps"`
	InviterRewardQuota   int            `json:"inviter_reward_quota"`
	DeletedAt            gorm.DeletedAt `gorm:"index"`
	ExpiredTime          int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, status string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})

	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
		} else {
			query = query.Where("name LIKE ?", keyword+"%")
		}
	}

	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (quota int, err error) {
	if key == "" {
		return 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	inviterRewardUserId := 0
	inviterRewardQuota := 0
	inviterRewardRateBps := 0

	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		if redemption.Quota <= 0 || redemption.Quota > common.MaxQuota {
			return errors.New("无效的兑换额度")
		}

		var redeemingUser User
		if err := tx.Select("id", "inviter_id").First(&redeemingUser, "id = ?", userId).Error; err != nil {
			return err
		}
		if redeemingUser.InviterId > 0 && redeemingUser.InviterId != userId {
			rateBps := common.RedemptionInviterRewardRateBps
			if rateBps < 0 || rateBps > 10000 {
				return errors.New("无效的兑换码邀请返利比例")
			}
			if rateBps > 0 {
				var inviter User
				inviterErr := tx.Select("id").First(&inviter, "id = ?", redeemingUser.InviterId).Error
				switch {
				case errors.Is(inviterErr, gorm.ErrRecordNotFound):
				case inviterErr != nil:
					return inviterErr
				default:
					rewardQuota64 := (int64(redemption.Quota)*int64(rateBps) + 5000) / 10000
					if rewardQuota64 < 0 || rewardQuota64 > int64(common.MaxQuota) {
						return errors.New("兑换码邀请返利额度超出范围")
					}
					if rewardQuota64 > 0 {
						inviterRewardUserId = inviter.Id
						inviterRewardRateBps = rateBps
						inviterRewardQuota = int(rewardQuota64)
					}
				}
			}
		}
		// Compare-and-swap on status: only the transaction that flips
		// enabled -> used may credit quota, so a concurrent redeem of the
		// same code loses here even without a row lock (e.g. on SQLite).
		result := tx.Model(&Redemption{}).
			Where("id = ? AND status = ?", redemption.Id, common.RedemptionCodeStatusEnabled).
			Updates(map[string]interface{}{
				"redeemed_time":           common.GetTimestamp(),
				"status":                  common.RedemptionCodeStatusUsed,
				"used_user_id":            userId,
				"inviter_reward_user_id":  inviterRewardUserId,
				"inviter_reward_rate_bps": inviterRewardRateBps,
				"inviter_reward_quota":    inviterRewardQuota,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("该兑换码已被使用")
		}
		result = tx.Model(&User{}).
			Where("id = ? AND quota <= ?", userId, common.MaxQuota-redemption.Quota).
			Update("quota", gorm.Expr("quota + ?", redemption.Quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("兑换用户额度超出范围")
		}
		if inviterRewardQuota == 0 {
			return nil
		}
		result = tx.Model(&User{}).
			Where("id = ? AND aff_quota <= ? AND aff_history <= ?", inviterRewardUserId, common.MaxQuota-inviterRewardQuota, common.MaxQuota-inviterRewardQuota).
			Updates(map[string]interface{}{
				"aff_quota":   gorm.Expr("aff_quota + ?", inviterRewardQuota),
				"aff_history": gorm.Expr("aff_history + ?", inviterRewardQuota),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("邀请人返利额度超出范围")
		}
		return nil
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, ErrRedeemFailed
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	if inviterRewardQuota > 0 {
		ratePercent := strconv.Itoa(inviterRewardRateBps / 100)
		fractionalPercent := inviterRewardRateBps % 100
		if fractionalPercent%10 != 0 {
			ratePercent = fmt.Sprintf("%d.%02d", inviterRewardRateBps/100, fractionalPercent)
		} else if fractionalPercent != 0 {
			ratePercent = fmt.Sprintf("%d.%d", inviterRewardRateBps/100, fractionalPercent/10)
		}
		RecordLog(inviterRewardUserId, LogTypeSystem, fmt.Sprintf(
			"受邀用户ID %d兑换 %s，获得邀请返利 %s，返利比例 %s%%，兑换码ID %d",
			userId,
			logger.LogQuota(redemption.Quota),
			logger.LogQuota(inviterRewardQuota),
			ratePercent,
			redemption.Id,
		))
	}
	return redemption.Quota, nil
}

func (redemption *Redemption) Insert() error {
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
